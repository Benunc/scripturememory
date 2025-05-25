import { useEffect, useState } from 'react';
import { db } from '../utils/db';
import { debug } from '../utils/debug';

export const useUnsavedChanges = () => {
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  useEffect(() => {
    const checkUnsavedChanges = async () => {
      try {
        const pendingChanges = await db.getPendingChanges();
        const unsyncedChanges = pendingChanges.filter(change => !change.synced);
        setHasUnsavedChanges(unsyncedChanges.length > 0);
      } catch (error) {
        debug.error('db', 'Error checking unsaved changes:', error);
      }
    };

    // Check initially
    checkUnsavedChanges();

    // Set up interval to check periodically
    const interval = setInterval(checkUnsavedChanges, 5000);

    // Set up beforeunload handler
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      clearInterval(interval);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [hasUnsavedChanges]);

  return hasUnsavedChanges;
}; 