import { useState, useEffect } from 'react';
import { useToast } from '@chakra-ui/react';
import { Verse } from '../types';
import { fetchVerses, addVerse as apiAddVerse, updateVerse as apiUpdateVerse, deleteVerse as apiDeleteVerse } from '../utils/verses';
import { useAuth } from './useAuth';

export function useVerses() {
  const [verses, setVerses] = useState<Verse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const toast = useToast();
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) {
      setVerses([]);
      setLoading(false);
      setError(null);
      return;
    }

    loadVerses();
  }, [isAuthenticated]);

  const loadVerses = async () => {
    if (!isAuthenticated) {
      setVerses([]);
      setLoading(false);
      setError(null);
      return;
    }

    try {
      setLoading(true);
      const data = await fetchVerses();
      setVerses(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load verses'));
      toast({
        title: "Error",
        description: "Failed to load verses",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  const addVerse = async (verse: Omit<Verse, 'lastReviewed' | 'reviewCount'>) => {
    if (!isAuthenticated) {
      throw new Error('Must be authenticated to add verses');
    }

    try {
      const newVerse = await apiAddVerse(verse);
      setVerses(prev => [...prev, newVerse]);
      toast({
        title: "Success",
        description: "Verse added successfully",
        status: "success",
        duration: 3000,
        isClosable: true,
      });
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to add verse",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
      throw err;
    }
  };

  const updateVerse = async (reference: string, updates: Partial<Verse>) => {
    if (!isAuthenticated) {
      throw new Error('Must be authenticated to update verses');
    }

    try {
      const updatedVerse = await apiUpdateVerse(reference, updates);
      setVerses(prev => prev.map(v => v.reference === reference ? updatedVerse : v));
      toast({
        title: "Success",
        description: "Verse updated successfully",
        status: "success",
        duration: 3000,
        isClosable: true,
      });
    } catch (err) {
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
    if (!isAuthenticated) {
      throw new Error('Must be authenticated to delete verses');
    }

    try {
      await apiDeleteVerse(reference);
      setVerses(prev => prev.filter(v => v.reference !== reference));
      toast({
        title: "Success",
        description: "Verse deleted successfully",
        status: "success",
        duration: 3000,
        isClosable: true,
      });
    } catch (err) {
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