import { Verse } from '../types';

declare module '../hooks/useVerses' {
  export interface UseVersesReturn {
    verses: Verse[];
    loading: boolean;
    error: string | null;
    addVerse: (verse: Omit<Verse, 'lastReviewed'>) => Promise<void>;
    updateVerse: (reference: string, updates: Partial<Verse>) => Promise<void>;
    deleteVerse: (reference: string) => Promise<void>;
  }

  /**
   * Hook for managing verses
   * @returns Object containing verses, loading state, error state, and verse management functions
   */
  export function useVerses(): UseVersesReturn;
} 