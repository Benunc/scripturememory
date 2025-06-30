import { useState, useEffect } from 'react';
import { useToast } from '@chakra-ui/react';
import { Verse } from '../types';
import { useAuthContext } from '../contexts/AuthContext';
import { getVerses, addVerse as apiAddVerse, updateVerse as apiUpdateVerse, deleteVerse as apiDeleteVerse } from '../utils/api';
import { debug } from '../utils/debug';

export function useVerses() {
  const [verses, setVerses] = useState<Verse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const toast = useToast();
  const { isAuthenticated, token, signOut } = useAuthContext();

  useEffect(() => {
    if (!isAuthenticated || !token) {
      setVerses([]);
      setLoading(false);
      setError(null);
      return;
    }

    loadVerses();
  }, [isAuthenticated, token]);

  const loadVerses = async () => {
    if (!isAuthenticated || !token) {
      setVerses([]);
      setLoading(false);
      setError(null);
      return;
    }

    try {
      setLoading(true);
      debug.log('verses', 'Fetching verses from server');
      
      const response = await getVerses(token);
      if (response.error) {
        // Check if this is a session expiration error
        if (response.error.includes('Invalid or expired session') || response.error.includes('Unauthorized')) {
          debug.log('verses', 'Session expired, signing out user');
          toast({
            title: "Session Expired",
            description: "Your session has expired. Please sign in again.",
            status: "info",
            duration: 3000,
            isClosable: true,
          });
          signOut();
          return;
        }
        throw new Error(response.error);
      }
      
      if (response.data) {
        debug.log('verses', 'Received verses from server:', response.data);
        setVerses(response.data);
      }
      
      setError(null);
    } catch (err) {
      debug.error('verses', 'Error loading verses:', err);
      setError(err instanceof Error ? err : new Error('Failed to load verses'));
      
      // Only show error toast for non-session-expiration errors
      if (err instanceof Error && 
          !err.message.includes('Invalid or expired session') && 
          !err.message.includes('Unauthorized')) {
        toast({
          title: "Trouble Loading Verses",
          description: "We're having trouble loading your verses. Please try again.",
          status: "warning",
          duration: 5000,
          isClosable: true,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const addVerse = async (verse: Omit<Verse, 'lastReviewed'>) => {
    if (!isAuthenticated || !token) {
      throw new Error('Must be authenticated to add verses');
    }

    try {
      debug.log('verses', 'Starting verse addition:', { verse });
      
      const response = await apiAddVerse(token, verse);
      if (response.error) {
        // Check if this is a session expiration error
        if (response.error.includes('Invalid or expired session') || response.error.includes('Unauthorized')) {
          debug.log('verses', 'Session expired during verse addition, signing out user');
          toast({
            title: "Session Expired",
            description: "Your session has expired. Please sign in again.",
            status: "info",
            duration: 3000,
            isClosable: true,
          });
          signOut();
          return;
        }
        throw new Error(response.error);
      }

      // Refresh verses after successful addition
      await loadVerses();
      
      debug.log('verses', 'Verse addition completed successfully');
    } catch (err) {
      debug.error('verses', 'Error adding verse:', err);
      if (err instanceof Error) {
        throw err;
      }
      throw new Error('Failed to add verse');
    }
  };

  const updateVerse = async (reference: string, updates: Partial<Verse>) => {
    if (!isAuthenticated || !token) {
      throw new Error('Must be authenticated to update verses');
    }

    try {
      const response = await apiUpdateVerse(token, reference, updates);
      if (response.error) {
        // Check if this is a session expiration error
        if (response.error.includes('Invalid or expired session') || response.error.includes('Unauthorized')) {
          debug.log('verses', 'Session expired during verse update, signing out user');
          toast({
            title: "Session Expired",
            description: "Your session has expired. Please sign in again.",
            status: "info",
            duration: 3000,
            isClosable: true,
          });
          signOut();
          return;
        }
        throw new Error(response.error);
      }

      // Update local state instead of refetching
      setVerses(prevVerses => 
        prevVerses.map(verse => 
          verse.reference === reference 
            ? { ...verse, ...updates }
            : verse
        )
      );
    } catch (err) {
      debug.error('verses', 'Error updating verse:', err);
      throw err;
    }
  };

  const deleteVerse = async (reference: string) => {
    if (!isAuthenticated || !token) {
      throw new Error('Must be authenticated to delete verses');
    }

    try {
      const response = await apiDeleteVerse(token, reference);
      if (response.error) {
        // Check if this is a session expiration error
        if (response.error.includes('Invalid or expired session') || response.error.includes('Unauthorized')) {
          debug.log('verses', 'Session expired during verse deletion, signing out user');
          toast({
            title: "Session Expired",
            description: "Your session has expired. Please sign in again.",
            status: "info",
            duration: 3000,
            isClosable: true,
          });
          signOut();
          return;
        }
        throw new Error(response.error);
      }

      // Refresh verses after successful deletion
      await loadVerses();

      toast({
        title: "Success",
        description: "Verse deleted successfully",
        status: "success",
        duration: 3000,
        isClosable: true,
      });
    } catch (err) {
      debug.error('verses', 'Error deleting verse:', err);
      toast({
        title: "Error",
        description: "Failed to delete verse",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
      throw err;
    }
  };

  return {
    verses,
    loading,
    error,
    addVerse,
    updateVerse,
    deleteVerse
  };
} 