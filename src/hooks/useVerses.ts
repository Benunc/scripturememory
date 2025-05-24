import { useState, useEffect } from 'react';
import { useToast, Button, Box, Flex, Text } from '@chakra-ui/react';
import { Verse } from '../types';
import { getVerses, addVerse as apiAddVerse, updateVerseStatus, deleteVerse as apiDeleteVerse } from '../utils/sheets';
import { useAuth } from './useAuth';
import { db } from '../utils/db';
import { debug } from '../utils/debug';

// Helper to convert between verse types
const convertToMainVerse = (verse: any): Verse => ({
  reference: verse.reference,
  text: verse.text,
  status: verse.status,
  lastReviewed: verse.lastReviewed || verse.dateAdded || new Date().toISOString()
});

export function useVerses() {
  const [verses, setVerses] = useState<Verse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const toast = useToast();
  const { isAuthenticated, isAuthorized, userEmail } = useAuth();

  useEffect(() => {
    if (!isAuthenticated || !isAuthorized || !userEmail) {
      setVerses([]);
      setLoading(false);
      setError(null);
      return;
    }

    loadVerses();
  }, [isAuthenticated, isAuthorized, userEmail]);

  const loadVerses = async () => {
    if (!isAuthenticated || !isAuthorized || !userEmail) {
      setVerses([]);
      setLoading(false);
      setError(null);
      return;
    }

    try {
      setLoading(true);
      
      // Initialize database if needed
      await db.init();
      
      // Always fetch from server first
      debug.log('verses', 'Fetching verses from server');
      const serverVerses = await getVerses(userEmail);
      debug.log('verses', 'Received verses from server:', serverVerses);
      
      // Get existing verses from local database
      const localVerses = await db.getVerses();
      debug.log('verses', 'Retrieved verses from local database:', localVerses);
      
      // Only update local DB if there are differences
      const serverVerseMap = new Map(serverVerses.map(v => [v.reference, v]));
      const localVerseMap = new Map(localVerses.map(v => [v.reference, v]));

      debug.log('verses', 'Server verse references:', Array.from(serverVerseMap.keys()));
      debug.log('verses', 'Local verse references:', Array.from(localVerseMap.keys()));

      // Delete verses that are no longer in the server
      for (const [ref, localVerse] of localVerseMap) {
        if (!serverVerseMap.has(ref)) {
          debug.log('verses', 'Deleting verse from local database:', ref);
          await db.deleteVerse(ref);
        }
      }

      // Add or update only changed verses
      for (const [ref, serverVerse] of serverVerseMap) {
        const localVerse = localVerseMap.get(ref);
        debug.log('verses', 'Comparing verses:', { 
          reference: ref,
          serverVerse: serverVerse,
          localVerse: localVerse,
          needsUpdate: !localVerse || 
            localVerse.text !== serverVerse.text || 
            localVerse.status !== serverVerse.status
        });
        
        if (!localVerse || 
            localVerse.text !== serverVerse.text || 
            localVerse.status !== serverVerse.status) {
          debug.log('verses', 'Updating verse in local database:', ref);
          await db.addVerse(convertToMainVerse(serverVerse));
        }
      }

      // Update UI with server verses immediately
      const convertedVerses = serverVerses
        .map(convertToMainVerse)
        .sort((a, b) => new Date(a.lastReviewed).getTime() - new Date(b.lastReviewed).getTime());
      debug.log('verses', 'Setting verses in UI:', convertedVerses);
      setVerses(convertedVerses);
      setError(null);
    } catch (err) {
      debug.error('verses', 'Error loading verses:', err);
      setError(err instanceof Error ? err : new Error('Failed to load verses'));
      toast({
        title: "Trouble Loading Verses",
        description: "We're having trouble loading your verses. This is usually temporary and can be fixed by clicking 'Retry'.",
        status: "warning",
        duration: null, // Keep it open until user dismisses
        isClosable: true,
        position: "top",
        onCloseComplete: () => {
          // If user dismisses without retrying, try again automatically
          loadVerses();
        }
      });
    } finally {
      setLoading(false);
    }
  };

  const addVerse = async (verse: Omit<Verse, 'lastReviewed'>) => {
    if (!isAuthenticated || !isAuthorized || !userEmail) {
      throw new Error('Must be authenticated and authorized to add verses');
    }

    try {
      debug.log('verses', 'Starting verse addition:', { verse });
      
      // Add to local database first
      const verseWithDefaults: Verse = {
        ...verse,
        lastReviewed: new Date().toISOString()
      };
      debug.log('verses', 'Adding to local database:', verseWithDefaults);
      await db.addVerse(verseWithDefaults);

      // Convert the new verse to the main type
      const newVerse = convertToMainVerse(verseWithDefaults);

      // Update UI by inserting the new verse at the correct position
      setVerses(prev => {
        const newDate = new Date(newVerse.lastReviewed).getTime();
        const insertIndex = prev.findIndex(v => new Date(v.lastReviewed).getTime() > newDate);
        const newVerses = [...prev];
        if (insertIndex === -1) {
          newVerses.push(newVerse);
        } else {
          newVerses.splice(insertIndex, 0, newVerse);
        }
        return newVerses;
      });

      // Then sync to server
      debug.log('verses', 'Syncing to server');
      await apiAddVerse(userEmail, verse);
      
      debug.log('verses', 'Verse addition completed successfully');
    } catch (err) {
      debug.error('verses', 'Error adding verse:', err);
      // Revert UI update if server sync fails
      const allVerses = await db.getVerses();
      setVerses(allVerses.map(convertToMainVerse));
      throw err;
    }
  };

  const updateVerse = async (reference: string, updates: Partial<Verse>) => {
    if (!isAuthenticated || !isAuthorized || !userEmail) {
      throw new Error('Must be authenticated and authorized to update verses');
    }

    try {
      // Update local database first
      await db.updateVerse(reference, updates);

      // Update UI immediately
      setVerses(prev => prev.map(v => 
        v.reference === reference
          ? { ...v, ...updates } 
          : v
      ));

      // Then sync to server if status is being updated
      if (updates.status) {
        await updateVerseStatus(userEmail, reference, updates.status);
      }

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
    if (!isAuthenticated || !isAuthorized || !userEmail) {
      throw new Error('Must be authenticated and authorized to delete verses');
    }

    try {
      // Delete from local database first
      await db.deleteVerse(reference);

      // Update UI immediately
      setVerses(prev => prev.filter(v => v.reference !== reference));

      // Then sync to server
      await apiDeleteVerse(userEmail, reference);

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