import { useState, useEffect } from 'react';
import { AdminRequest } from './useAdmin';

const TRASH_STORAGE_KEY = 'admin_trash_requests';

export interface TrashedRequest extends AdminRequest {
  deletedAt: string;
  originalCategory: 'new' | 'pending' | 'in_progress' | 'done';
}

export const useAdminTrash = () => {
  const [trashedRequests, setTrashedRequests] = useState<TrashedRequest[]>([]);

  // Load trash from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(TRASH_STORAGE_KEY);
    if (stored) {
      try {
        setTrashedRequests(JSON.parse(stored));
      } catch (e) {
        console.error('Error loading trash:', e);
        setTrashedRequests([]);
      }
    }
  }, []);

  // Save to localStorage whenever trash changes
  const saveTrash = (items: TrashedRequest[]) => {
    localStorage.setItem(TRASH_STORAGE_KEY, JSON.stringify(items));
    setTrashedRequests(items);
  };

  // Move request to trash (soft delete)
  const moveToTrash = (request: AdminRequest, category: TrashedRequest['originalCategory']) => {
    const trashedRequest: TrashedRequest = {
      ...request,
      deletedAt: new Date().toISOString(),
      originalCategory: category,
    };
    const updated = [trashedRequest, ...trashedRequests];
    saveTrash(updated);
    return request.id;
  };

  // Move multiple requests to trash
  const moveMultipleToTrash = (requests: AdminRequest[], category: TrashedRequest['originalCategory']) => {
    const trashedItems: TrashedRequest[] = requests.map(request => ({
      ...request,
      deletedAt: new Date().toISOString(),
      originalCategory: category,
    }));
    const updated = [...trashedItems, ...trashedRequests];
    saveTrash(updated);
    return requests.map(r => r.id);
  };

  // Restore request from trash
  const restoreFromTrash = (requestId: string): TrashedRequest | null => {
    const request = trashedRequests.find(r => r.id === requestId);
    if (request) {
      const updated = trashedRequests.filter(r => r.id !== requestId);
      saveTrash(updated);
      return request;
    }
    return null;
  };

  // Restore multiple requests
  const restoreMultipleFromTrash = (requestIds: string[]): TrashedRequest[] => {
    const requests = trashedRequests.filter(r => requestIds.includes(r.id));
    const updated = trashedRequests.filter(r => !requestIds.includes(r.id));
    saveTrash(updated);
    return requests;
  };

  // Permanently delete from trash
  const permanentlyDelete = (requestId: string) => {
    const updated = trashedRequests.filter(r => r.id !== requestId);
    saveTrash(updated);
  };

  // Permanently delete multiple
  const permanentlyDeleteMultiple = (requestIds: string[]) => {
    const updated = trashedRequests.filter(r => !requestIds.includes(r.id));
    saveTrash(updated);
  };

  // Clear all trash
  const emptyTrash = () => {
    saveTrash([]);
  };

  // Check if a request is in trash
  const isInTrash = (requestId: string) => {
    return trashedRequests.some(r => r.id === requestId);
  };

  return {
    trashedRequests,
    moveToTrash,
    moveMultipleToTrash,
    restoreFromTrash,
    restoreMultipleFromTrash,
    permanentlyDelete,
    permanentlyDeleteMultiple,
    emptyTrash,
    isInTrash,
  };
};
