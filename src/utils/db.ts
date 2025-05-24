import { ProgressStatus } from './progress';
import { debug } from './debug';
import { Verse as MainVerse } from '../types';

// Use the main Verse type from types.ts
export type Verse = MainVerse;

// Pending change interface
export interface PendingChange {
  id?: number;  // Optional because it's auto-generated
  type: 'STATUS_UPDATE' | 'ADD_VERSE' | 'DELETE_VERSE';
  verseReference: string;
  newStatus?: string;
  timestamp: number;
  synced: boolean;
}

const DB_NAME = 'scripture-memory-db';
const DB_VERSION = 2;

// Store names
const STORES = {
  VERSES: 'verses',
  PENDING_CHANGES: 'pending-changes',
} as const;

class Database {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      // First check the current version
      const checkRequest = indexedDB.open(DB_NAME);
      
      checkRequest.onerror = () => {
        debug.error('db', 'Error checking database version:', checkRequest.error);
        // Continue with normal initialization
        this.initializeDatabase(resolve, reject);
      };

      checkRequest.onsuccess = () => {
        const db = checkRequest.result;
        const currentVersion = db.version;
        db.close();

        if (currentVersion < DB_VERSION) {
          debug.log('db', `Upgrading database from version ${currentVersion} to ${DB_VERSION}`);
          // Delete old database
          const deleteRequest = indexedDB.deleteDatabase(DB_NAME);
          
          deleteRequest.onerror = () => {
            debug.error('db', 'Error deleting old database:', deleteRequest.error);
            // Continue anyway - we'll try to open the new version
          };

          deleteRequest.onsuccess = () => {
            debug.log('db', 'Old database deleted successfully');
            this.initializeDatabase(resolve, reject);
          };
        } else {
          // No upgrade needed, proceed with normal initialization
          this.initializeDatabase(resolve, reject);
        }
      };
    });
  }

  private initializeDatabase(resolve: () => void, reject: (error: Error) => void): void {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      debug.error('db', 'Error opening database:', request.error);
      reject(new Error(`Failed to open database: ${request.error?.message || 'Unknown error'}`));
    };

    request.onsuccess = () => {
      this.db = request.result;
      debug.log('db', 'Database opened successfully');
      resolve();
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Create verses store with reference as key
      const verseStore = db.createObjectStore(STORES.VERSES, { 
        keyPath: 'reference'
      });
      verseStore.createIndex('status', 'status', { unique: false });
      verseStore.createIndex('dateAdded', 'dateAdded', { unique: false });
      verseStore.createIndex('lastReviewed', 'lastReviewed', { unique: false });
      verseStore.createIndex('reference', 'reference', { unique: true }); // Make reference unique

      // Create pending changes store
      if (!db.objectStoreNames.contains(STORES.PENDING_CHANGES)) {
        const changesStore = db.createObjectStore(STORES.PENDING_CHANGES, { keyPath: 'id', autoIncrement: true });
        changesStore.createIndex('synced', 'synced', { unique: false });
        changesStore.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
  }

  // Verse operations
  async getVerses(): Promise<Verse[]> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction(STORES.VERSES, 'readonly');
      const store = transaction.objectStore(STORES.VERSES);
      const request = store.getAll();

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        debug.error('db', 'Error getting verses:', request.error);
        reject(new Error(`Failed to get verses: ${request.error?.message || 'Unknown error'}`));
      };
    });
  }

  async addVerse(verse: Verse): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction(STORES.VERSES, 'readwrite');
      const store = transaction.objectStore(STORES.VERSES);

      // Try to add the verse - this will fail if the reference already exists
      const request = store.add(verse);
      
      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        if (request.error?.name === 'ConstraintError') {
          reject(new Error('A verse with this reference already exists. Please delete it first.'));
        } else {
          debug.error('db', 'Error adding verse:', request.error);
          reject(new Error(`Failed to add verse: ${request.error?.message || 'Unknown error'}`));
        }
      };
    });
  }

  async updateVerse(reference: string, updates: Partial<Verse>): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      if (!updates || Object.keys(updates).length === 0) {
        reject(new Error('No updates provided'));
        return;
      }

      const transaction = this.db.transaction(STORES.VERSES, 'readwrite');
      const store = transaction.objectStore(STORES.VERSES);
      
      // Get the verse by reference
      const request = store.get(reference);

      request.onsuccess = () => {
        const verse = request.result;
        if (!verse) {
          debug.error('db', 'No verse found with reference:', reference);
          reject(new Error('Verse not found'));
          return;
        }

        // When updating status, also update lastReviewed to now
        const updatedVerse = { 
          ...verse, 
          ...updates,
          lastReviewed: new Date().toISOString()
        };
        const updateRequest = store.put(updatedVerse);

        updateRequest.onsuccess = () => {
          resolve();
        };

        updateRequest.onerror = () => {
          debug.error('db', 'Error updating verse:', updateRequest.error);
          reject(new Error(`Failed to update verse: ${updateRequest.error?.message || 'Unknown error'}`));
        };
      };

      request.onerror = () => {
        debug.error('db', 'Error getting verse for update:', request.error);
        reject(new Error(`Failed to get verse for update: ${request.error?.message || 'Unknown error'}`));
      };
    });
  }

  async deleteVerse(reference: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction(STORES.VERSES, 'readwrite');
      const store = transaction.objectStore(STORES.VERSES);
      const request = store.delete(reference);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        debug.error('db', 'Error deleting verse:', request.error);
        reject(new Error(`Failed to delete verse: ${request.error?.message || 'Unknown error'}`));
      };
    });
  }

  async getVerse(reference: string): Promise<Verse | null> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction(STORES.VERSES, 'readonly');
      const store = transaction.objectStore(STORES.VERSES);
      const request = store.get(reference);

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = () => {
        debug.error('db', 'Error getting verse:', request.error);
        reject(request.error);
      };
    });
  }

  // Pending changes operations
  async addPendingChange(change: Omit<PendingChange, 'id' | 'synced'>): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction(STORES.PENDING_CHANGES, 'readwrite');
      const store = transaction.objectStore(STORES.PENDING_CHANGES);
      const request = store.add({
        ...change,
        synced: false,
      });

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        debug.error('db', 'Error adding pending change:', request.error);
        reject(request.error);
      };
    });
  }

  async getPendingChanges(): Promise<PendingChange[]> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction(STORES.PENDING_CHANGES, 'readonly');
      const store = transaction.objectStore(STORES.PENDING_CHANGES);
      const request = store.getAll();

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        debug.error('db', 'Error getting pending changes:', request.error);
        reject(request.error);
      };
    });
  }

  async markChangesAsSynced(changeIds: (string | number)[]): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction(STORES.PENDING_CHANGES, 'readwrite');
      const store = transaction.objectStore(STORES.PENDING_CHANGES);

      const promises = changeIds.map(id => {
        return new Promise<void>((resolveChange, rejectChange) => {
          const deleteRequest = store.delete(id);
          deleteRequest.onsuccess = () => resolveChange();
          deleteRequest.onerror = () => rejectChange(deleteRequest.error);
        });
      });

      Promise.all(promises)
        .then(() => resolve())
        .catch(error => {
          debug.error('db', 'Error marking changes as synced:', error);
          reject(error);
        });
    });
  }

  // Debug-only method to clear all pending changes
  async debug_clearPendingChanges(): Promise<void> {
    if (!window.debug.getConfig().enabled) {
      console.warn('Debug mode must be enabled to clear pending changes');
      return;
    }

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction(STORES.PENDING_CHANGES, 'readwrite');
      const store = transaction.objectStore(STORES.PENDING_CHANGES);
      const request = store.clear();

      request.onsuccess = () => {
        debug.log('db', 'All pending changes cleared from database');
        resolve();
      };

      request.onerror = () => {
        debug.error('db', 'Error clearing pending changes:', request.error);
        reject(request.error);
      };
    });
  }

  async updatePendingChange(id: number, change: Omit<PendingChange, 'id'>): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction(STORES.PENDING_CHANGES, 'readwrite');
      const store = transaction.objectStore(STORES.PENDING_CHANGES);
      const request = store.put({ ...change, id });

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        debug.error('db', 'Error updating pending change:', request.error);
        reject(request.error);
      };
    });
  }

  async clearDatabase(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([STORES.VERSES, STORES.PENDING_CHANGES], 'readwrite');
      const verseStore = transaction.objectStore(STORES.VERSES);
      const changesStore = transaction.objectStore(STORES.PENDING_CHANGES);

      const verseRequest = verseStore.clear();
      const changesRequest = changesStore.clear();

      Promise.all([
        new Promise<void>((resolve, reject) => {
          verseRequest.onsuccess = () => resolve();
          verseRequest.onerror = () => reject(verseRequest.error);
        }),
        new Promise<void>((resolve, reject) => {
          changesRequest.onsuccess = () => resolve();
          changesRequest.onerror = () => reject(changesRequest.error);
        })
      ]).then(() => {
        debug.log('db', 'Database cleared successfully');
        resolve();
      }).catch(error => {
        debug.error('db', 'Error clearing database:', error);
        reject(error);
      });
    });
  }
}

// Create and export a singleton instance
export const db = new Database(); 