import { useState, useEffect } from 'react';
import { useToast } from '@chakra-ui/react';
import { Verse } from '../types';
import { useAuth } from './useAuth';
import { getVerses, addVerse as apiAddVerse, updateVerse as apiUpdateVerse, deleteVerse as apiDeleteVerse } from '../utils/api';
import { debug } from '../utils/debug';

export function useVerses() {
  const [verses, setVerses] = useState<Verse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const toast = useToast();
  const { isAuthenticated, token } = useAuth();

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
      toast({
        title: "Trouble Loading Verses",
        description: "We're having trouble loading your verses. This is usually temporary and can be fixed by clicking 'Retry'.",
        status: "warning",
        duration: null,
        isClosable: true,
        position: "top",
        onCloseComplete: () => {
          loadVerses();
        }
      });
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
        throw new Error(response.error);
      }

      // Refresh verses after successful update
      await loadVerses();

      toast({
        title: "Success",
        description: "Verse updated successfully",
        status: "success",
        duration: 3000,
        isClosable: true,
      });
    } catch (err) {
      debug.error('verses', 'Error updating verse:', err);
      toast({
        title: "Error",
        description: "Failed to update verse",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
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