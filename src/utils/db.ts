import { ProgressStatus } from './progress';
import { debug } from './debug';

// Unified Verse interface for local storage
export interface Verse {
  reference: string;
  text: string;
  status: ProgressStatus;
  dateAdded: string;
  lastReviewed?: string;
  reviewCount?: number;
}

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
const DB_VERSION = 1;

// Store names
const STORES = {
  VERSES: 'verses',
  PENDING_CHANGES: 'pending-changes',
} as const;

class Database {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        debug.error('db', 'Error opening database:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        debug.log('db', 'Database opened successfully');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create verses store
        if (!db.objectStoreNames.contains(STORES.VERSES)) {
          const verseStore = db.createObjectStore(STORES.VERSES, { keyPath: 'reference' });
          verseStore.createIndex('status', 'status', { unique: false });
          verseStore.createIndex('dateAdded', 'dateAdded', { unique: false });
        }

        // Create pending changes store
        if (!db.objectStoreNames.contains(STORES.PENDING_CHANGES)) {
          const changesStore = db.createObjectStore(STORES.PENDING_CHANGES, { keyPath: 'id', autoIncrement: true });
          changesStore.createIndex('synced', 'synced', { unique: false });
          changesStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
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
        reject(request.error);
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
      const request = store.add(verse);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        debug.error('db', 'Error adding verse:', request.error);
        reject(request.error);
      };
    });
  }

  async updateVerse(reference: string, updates: Partial<Verse>): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction(STORES.VERSES, 'readwrite');
      const store = transaction.objectStore(STORES.VERSES);
      const getRequest = store.get(reference);

      getRequest.onsuccess = () => {
        const verse = getRequest.result;
        if (!verse) {
          reject(new Error('Verse not found'));
          return;
        }

        const updatedVerse = { ...verse, ...updates };
        const updateRequest = store.put(updatedVerse);

        updateRequest.onsuccess = () => {
          resolve();
        };

        updateRequest.onerror = () => {
          debug.error('db', 'Error updating verse:', updateRequest.error);
          reject(updateRequest.error);
        };
      };

      getRequest.onerror = () => {
        debug.error('db', 'Error getting verse for update:', getRequest.error);
        reject(getRequest.error);
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
        reject(request.error);
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
}

// Create and export a singleton instance
export const db = new Database(); 