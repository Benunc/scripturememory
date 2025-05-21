import { db, PendingChange } from './db';
import { debug } from './debug';
import { updateVerseStatus, addVerse as addVerseToSheets, deleteVerse as deleteVerseFromSheets } from './sheets';

// Event emitter for sync status
type SyncStatus = 'idle' | 'syncing' | 'error' | 'rate_limited';
type SyncStatusCallback = (status: SyncStatus) => void;

class RateLimiter {
  private requests: number[] = [];
  private readonly windowMs: number;
  private readonly maxRequests: number;

  constructor(windowMs: number = 60000, maxRequests: number = 30) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
  }

  canMakeRequest(): boolean {
    const now = Date.now();
    this.requests = this.requests.filter(time => now - time < this.windowMs);
    return this.requests.length < this.maxRequests;
  }

  recordRequest() {
    this.requests.push(Date.now());
  }

  getRemainingRequests(): number {
    const now = Date.now();
    this.requests = this.requests.filter(time => now - time < this.windowMs);
    return Math.max(0, this.maxRequests - this.requests.length);
  }

  getTimeUntilNextRequest(): number {
    if (this.canMakeRequest()) return 0;
    const now = Date.now();
    const oldestRequest = Math.min(...this.requests);
    return Math.max(0, oldestRequest + this.windowMs - now);
  }

  // Debug getters
  getWindowMs(): number {
    return this.windowMs;
  }

  getMaxRequests(): number {
    return this.maxRequests;
  }

  getRequests(): number[] {
    return [...this.requests];
  }
}

class SyncService {
  private syncInProgress = false;
  private readonly MAX_RETRIES = 3;
  private readonly RATE_LIMIT_DELAY = 2000; // 2 seconds between API calls
  private readonly MAX_QUEUE_SIZE = 100; // Maximum number of pending changes to process at once
  private userEmail: string | null = null;
  private status: SyncStatus = 'idle';
  private statusCallbacks: SyncStatusCallback[] = [];
  private retryCount = 0;
  private lastSyncTime = 0;
  private rateLimiter = new RateLimiter();
  private syncQueue: PendingChange[] = [];
  private isQueueProcessing = false;
  private isManualSync = false;

  constructor() {
    // No automatic sync interval
  }

  setUserEmail(email: string) {
    this.userEmail = email;
  }

  // Subscribe to sync status changes
  onStatusChange(callback: SyncStatusCallback) {
    this.statusCallbacks.push(callback);
    // Immediately notify of current status
    callback(this.status);
    return () => {
      this.statusCallbacks = this.statusCallbacks.filter(cb => cb !== callback);
    };
  }

  private setStatus(newStatus: SyncStatus) {
    if (this.status !== newStatus) {
      this.status = newStatus;
      this.statusCallbacks.forEach(callback => callback(newStatus));
    }
  }

  private async waitForRateLimit() {
    if (!this.rateLimiter.canMakeRequest()) {
      const waitTime = this.rateLimiter.getTimeUntilNextRequest();
      this.setStatus('rate_limited');
      debug.log('db', `Rate limited. Waiting ${waitTime}ms before next request`);
      debug.log('db', `Rate limit status: ${this.rateLimiter.getRemainingRequests()} requests remaining in current window`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    this.rateLimiter.recordRequest();
    debug.log('db', `API request recorded. ${this.rateLimiter.getRemainingRequests()} requests remaining in current window`);
  }

  private async processQueue() {
    if (this.isQueueProcessing || this.syncQueue.length === 0) return;

    this.isQueueProcessing = true;
    debug.log('db', `Starting queue processing. Queue size: ${this.syncQueue.length}`);
    debug.log('db', 'Queue contents:', this.syncQueue.map(change => ({
      type: change.type,
      verseReference: change.verseReference,
      timestamp: new Date(change.timestamp).toISOString()
    })));

    try {
      while (this.syncQueue.length > 0) {
        const change = this.syncQueue[0];
        debug.log('db', `Processing change: ${change.type} for verse ${change.verseReference}`);
        await this.processChange(change);
        this.syncQueue.shift(); // Remove processed change
        debug.log('db', `Change processed. Remaining queue size: ${this.syncQueue.length}`);
      }
    } finally {
      this.isQueueProcessing = false;
      debug.log('db', 'Queue processing completed');
    }
  }

  private async processChange(change: PendingChange) {
    if (!this.userEmail) return;

    try {
      await this.waitForRateLimit();

      switch (change.type) {
        case 'STATUS_UPDATE':
          await updateVerseStatus(this.userEmail, change.verseReference, change.newStatus!);
          break;
        case 'ADD_VERSE':
          const verse = await db.getVerse(change.verseReference);
          if (verse) {
            await addVerseToSheets(this.userEmail, {
              reference: verse.reference,
              text: verse.text,
              status: verse.status
            });
          }
          break;
        case 'DELETE_VERSE':
          await deleteVerseFromSheets(this.userEmail, change.verseReference);
          break;
      }

      await db.markChangesAsSynced([change.id]);
    } catch (error) {
      debug.error('db', `Error processing change:`, error);
      // Don't remove from queue, it will be retried
      throw error;
    }
  }

  async sync() {
    if (this.syncInProgress || !this.userEmail) {
      debug.log('db', 'Sync skipped - in progress or no user email');
      return;
    }

    try {
      this.syncInProgress = true;
      this.setStatus('syncing');
      debug.log('db', 'Starting sync of pending changes');

      const pendingChanges = await db.getPendingChanges();
      debug.log('db', `Found ${pendingChanges.length} pending changes to sync`);
      
      if (pendingChanges.length === 0) {
        debug.log('db', 'No pending changes to sync');
        this.setStatus('idle');
        return;
      }

      // Add changes to queue, limiting the number processed at once
      this.syncQueue = pendingChanges.slice(0, this.MAX_QUEUE_SIZE);
      debug.log('db', `Added ${this.syncQueue.length} changes to sync queue (max: ${this.MAX_QUEUE_SIZE})`);
      await this.processQueue();

      debug.log('db', 'Sync completed successfully');
      this.setStatus('idle');
      this.retryCount = 0; // Reset retry count on success
    } catch (error) {
      debug.error('db', 'Error during sync:', error);
      this.setStatus('error');
      
      // Only retry if this was a manual sync
      if (this.isManualSync && this.retryCount < this.MAX_RETRIES) {
        this.retryCount++;
        const backoffTime = Math.min(1000 * Math.pow(2, this.retryCount), 30000); // Max 30 seconds
        debug.log('db', `Retrying sync in ${backoffTime}ms (attempt ${this.retryCount}/${this.MAX_RETRIES})`);
        setTimeout(() => this.sync(), backoffTime);
      } else {
        debug.error('db', `Sync failed after ${this.retryCount} retries`);
      }
    } finally {
      this.syncInProgress = false;
      this.isManualSync = false;
    }
  }

  // Manual sync method
  async manualSync() {
    if (this.syncInProgress) {
      debug.log('db', 'Sync already in progress');
      return;
    }

    try {
      this.isManualSync = true;
      await this.sync();
    } catch (error) {
      debug.error('db', 'Error during manual sync:', error);
      throw error;
    }
  }

  // Get number of pending changes
  async getPendingChangesCount(): Promise<number> {
    const pendingChanges = await db.getPendingChanges();
    return pendingChanges.length;
  }

  // Get current sync status
  getStatus(): SyncStatus {
    return this.status;
  }

  // Get number of remaining API requests in current window
  getRemainingRequests(): number {
    return this.rateLimiter.getRemainingRequests();
  }

  // Debug-only method to flush the queue
  async debug_flushQueue() {
    if (!window.debug.getConfig().enabled) {
      console.warn('Debug mode must be enabled to flush the queue');
      return;
    }
    
    debug.log('db', 'Flushing sync queue');
    debug.log('db', `Queue size before flush: ${this.syncQueue.length}`);
    
    try {
      // Clear in-memory queue
      this.syncQueue = [];
      this.isQueueProcessing = false;
      this.retryCount = 0;
      this.setStatus('idle');

      // Clear all pending changes from IndexedDB
      await db.debug_clearPendingChanges();

      debug.log('db', 'Queue and pending changes flushed, sync state reset');
    } catch (error) {
      debug.error('db', 'Error flushing queue:', error);
    }
  }

  // Debug-only method to check rate limit state
  debug_getRateLimitState() {
    if (!window.debug.getConfig().enabled) {
      console.warn('Debug mode must be enabled to check rate limit state');
      return null;
    }

    const now = Date.now();
    const windowStart = now - this.rateLimiter.getWindowMs();
    const recentRequests = this.rateLimiter.getRequests().filter(time => time >= windowStart);
    
    return {
      currentWindow: {
        start: new Date(windowStart).toISOString(),
        end: new Date(now).toISOString(),
        duration: this.rateLimiter.getWindowMs(),
      },
      requests: {
        total: this.rateLimiter.getRequests().length,
        inCurrentWindow: recentRequests.length,
        remaining: this.rateLimiter.getRemainingRequests(),
        maxPerWindow: this.rateLimiter.getMaxRequests(),
      },
      timing: {
        timeUntilNextRequest: this.rateLimiter.getTimeUntilNextRequest(),
        lastRequest: this.rateLimiter.getRequests().length > 0 
          ? new Date(Math.max(...this.rateLimiter.getRequests())).toISOString()
          : null,
      },
      queue: {
        size: this.syncQueue.length,
        processing: this.isQueueProcessing,
        status: this.status,
      }
    };
  }
}

// Create and export a singleton instance
export const syncService = new SyncService();

// Expose debug methods to window
declare global {
  interface Window {
    syncService: typeof syncService;
  }
}

window.syncService = syncService; 