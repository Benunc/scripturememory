import { Verse } from '../types';

declare module '../hooks/useVerses' {
  export interface UseVersesReturn {
    verses: Verse[];
    loading: boolean;
    error: string | null;
    refreshVerses: () => Promise<void>;
  }

  /**
   * Hook for managing verses
   * @returns Object containing verses, loading state, error state, and refresh function
   */
  export function useVerses(): UseVersesReturn;
} 