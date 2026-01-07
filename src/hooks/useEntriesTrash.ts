import { useState, useEffect } from 'react';

const ENTRIES_TRASH_STORAGE_KEY = 'admin_entries_trash';

export interface TrashedEntry {
  id: string;
  type: 'movie' | 'series';
  content: any;
  title: string;
  posterUrl: string | null;
  deletedAt: string;
}

export const useEntriesTrash = () => {
  const [trashedEntries, setTrashedEntries] = useState<TrashedEntry[]>([]);

  // Load trash from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(ENTRIES_TRASH_STORAGE_KEY);
    if (stored) {
      try {
        setTrashedEntries(JSON.parse(stored));
      } catch (e) {
        console.error('Error loading entries trash:', e);
        setTrashedEntries([]);
      }
    }
  }, []);

  // Save to localStorage whenever trash changes
  const saveTrash = (items: TrashedEntry[]) => {
    localStorage.setItem(ENTRIES_TRASH_STORAGE_KEY, JSON.stringify(items));
    setTrashedEntries(items);
  };

  // Move entry to trash (soft delete)
  const moveToTrash = (entry: TrashedEntry) => {
    const trashedEntry: TrashedEntry = {
      ...entry,
      deletedAt: new Date().toISOString(),
    };
    const updated = [trashedEntry, ...trashedEntries];
    saveTrash(updated);
    return entry.id;
  };

  // Restore entry from trash
  const restoreFromTrash = (entryId: string): TrashedEntry | null => {
    const entry = trashedEntries.find(e => e.id === entryId);
    if (entry) {
      const updated = trashedEntries.filter(e => e.id !== entryId);
      saveTrash(updated);
      return entry;
    }
    return null;
  };

  // Permanently delete from trash
  const permanentlyDelete = (entryId: string) => {
    const updated = trashedEntries.filter(e => e.id !== entryId);
    saveTrash(updated);
  };

  // Clear all trash
  const emptyTrash = () => {
    saveTrash([]);
  };

  // Check if an entry is in trash
  const isInTrash = (entryId: string) => {
    return trashedEntries.some(e => e.id === entryId);
  };

  return {
    trashedEntries,
    moveToTrash,
    restoreFromTrash,
    permanentlyDelete,
    emptyTrash,
    isInTrash,
  };
};
