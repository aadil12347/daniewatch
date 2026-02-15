import { createContext, useContext, useEffect, useState, useCallback, useMemo, ReactNode, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase, isSupabaseConfigured } from "@/integrations/supabase/client";
import { RealtimeChannel } from "@supabase/supabase-js";

// Data structure for continue watching items
export interface ContinueWatchingItem {
    tmdbId: number;
    mediaType: "movie" | "tv";
    title: string;
    posterPath: string | null;
    season?: number;
    episode?: number;
    timestamp: number;
}

// Storage keys
const LOCAL_STORAGE_KEY = "daniewatch_continue_watching";
const MAX_ITEMS = 10; // Maximum 10 items in continue watching

// Context type
interface ContinueWatchingContextValue {
    items: ContinueWatchingItem[];
    isLoading: boolean;
    saveItem: (item: Omit<ContinueWatchingItem, "timestamp">) => Promise<void>;
    removeItem: (tmdbId: number, mediaType: "movie" | "tv") => Promise<void>;
    clearAll: () => Promise<void>;
    migrateLocalToSupabase: () => Promise<void>;
}

const ContinueWatchingContext = createContext<ContinueWatchingContextValue | null>(null);

// Helper functions for localStorage
const getLocalItems = (): ContinueWatchingItem[] => {
    try {
        const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (!stored) return [];
        const parsed = JSON.parse(stored);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
};

const saveLocalItems = (items: ContinueWatchingItem[]): void => {
    try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(items));
    } catch {
        // Ignore storage errors
    }
};

// Deduplicate and move to front - keeps only one entry per tmdbId+mediaType
// For TV shows, this means only the latest played episode/season is kept
const dedupeAndReorder = (
    items: ContinueWatchingItem[],
    newItem: ContinueWatchingItem
): ContinueWatchingItem[] => {
    // Remove existing item with same tmdbId and mediaType (regardless of season/episode)
    const filtered = items.filter(
        (item) => !(item.tmdbId === newItem.tmdbId && item.mediaType === newItem.mediaType)
    );
    // Add new item at the front and limit to MAX_ITEMS
    return [newItem, ...filtered].slice(0, MAX_ITEMS);
};

// Map database row to ContinueWatchingItem
const mapRowToItem = (row: any): ContinueWatchingItem => ({
    tmdbId: row.tmdb_id,
    mediaType: row.media_type,
    title: row.title,
    posterPath: row.poster_path,
    season: row.season,
    episode: row.episode,
    timestamp: new Date(row.timestamp).getTime(),
});

// Provider component
export function ContinueWatchingProvider({ children }: { children: ReactNode }) {
    const { user } = useAuth();
    const [items, setItems] = useState<ContinueWatchingItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const channelRef = useRef<RealtimeChannel | null>(null);

    // Load items on mount and when user changes
    useEffect(() => {
        let cancelled = false;

        const loadItems = async () => {
            setIsLoading(true);

            if (!user?.id || !isSupabaseConfigured) {
                // Guest mode: load from localStorage
                const localItems = getLocalItems().slice(0, MAX_ITEMS);
                if (!cancelled) {
                    setItems(localItems);
                    setIsLoading(false);
                }
                return;
            }

            // Authenticated: load from Supabase
            try {
                // First, migrate any local items to Supabase
                const localItems = getLocalItems();
                if (localItems.length > 0) {
                    const rows = localItems.map((item) => ({
                        user_id: user.id,
                        tmdb_id: item.tmdbId,
                        media_type: item.mediaType,
                        title: item.title,
                        poster_path: item.posterPath,
                        season: item.season,
                        episode: item.episode,
                        timestamp: new Date(item.timestamp).toISOString(),
                    }));

                    await supabase.from("continue_watching").upsert(rows, {
                        onConflict: "user_id,tmdb_id,media_type",
                    });

                    // Clear local storage after successful migration
                    localStorage.removeItem(LOCAL_STORAGE_KEY);
                }

                const { data, error } = await supabase
                    .from("continue_watching")
                    .select("*")
                    .eq("user_id", user.id)
                    .order("timestamp", { ascending: false })
                    .limit(MAX_ITEMS);

                if (error) throw error;

                if (!cancelled) {
                    const mappedItems = (data || []).map(mapRowToItem);
                    setItems(mappedItems);
                    setIsLoading(false);
                }
            } catch (error) {
                console.error("Failed to load continue watching items:", error);
                if (!cancelled) {
                    // Fallback to localStorage
                    const localItems = getLocalItems().slice(0, MAX_ITEMS);
                    setItems(localItems);
                    setIsLoading(false);
                }
            }
        };

        loadItems();

        return () => {
            cancelled = true;
        };
    }, [user?.id]);

    // Set up realtime subscription for authenticated users
    useEffect(() => {
        if (!user?.id || !isSupabaseConfigured) {
            // Clean up any existing channel
            if (channelRef.current) {
                supabase.removeChannel(channelRef.current);
                channelRef.current = null;
            }
            return;
        }

        // Clean up existing channel before creating new one
        if (channelRef.current) {
            supabase.removeChannel(channelRef.current);
        }

        // Create realtime channel for continue_watching table
        const channel = supabase
            .channel(`continue_watching:${user.id}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'continue_watching',
                    filter: `user_id=eq.${user.id}`,
                },
                (payload) => {
                    const { eventType, new: newRow, old: oldRow } = payload;

                    if (eventType === 'INSERT') {
                        const newItem = mapRowToItem(newRow);
                        setItems((prev) => {
                            // Check if item already exists (avoid duplicates)
                            const exists = prev.some(
                                (item) => item.tmdbId === newItem.tmdbId && item.mediaType === newItem.mediaType
                            );
                            if (exists) return prev;
                            // Add new item at the front and limit
                            return [newItem, ...prev].slice(0, MAX_ITEMS);
                        });
                    } else if (eventType === 'UPDATE') {
                        const updatedItem = mapRowToItem(newRow);
                        setItems((prev) => {
                            // Remove old version and add updated at front
                            const filtered = prev.filter(
                                (item) => !(item.tmdbId === updatedItem.tmdbId && item.mediaType === updatedItem.mediaType)
                            );
                            return [updatedItem, ...filtered].slice(0, MAX_ITEMS);
                        });
                    } else if (eventType === 'DELETE') {
                        const oldItem = mapRowToItem(oldRow);
                        setItems((prev) =>
                            prev.filter(
                                (item) => !(item.tmdbId === oldItem.tmdbId && item.mediaType === oldItem.mediaType)
                            )
                        );
                    }
                }
            )
            .subscribe();

        channelRef.current = channel;

        return () => {
            if (channelRef.current) {
                supabase.removeChannel(channelRef.current);
                channelRef.current = null;
            }
        };
    }, [user?.id]);

    // Save item (with optimistic update)
    const saveItem = useCallback(
        async (item: Omit<ContinueWatchingItem, "timestamp">) => {
            const newItem: ContinueWatchingItem = {
                ...item,
                timestamp: Date.now(),
            };

            // Optimistic update - dedupe and limit to MAX_ITEMS
            setItems((prev) => dedupeAndReorder(prev, newItem));

            if (!user?.id || !isSupabaseConfigured) {
                // Guest mode: save to localStorage
                const localItems = getLocalItems();
                const updated = dedupeAndReorder(localItems, newItem);
                saveLocalItems(updated);
                return;
            }

            // Authenticated: save to Supabase (realtime will handle the update)
            try {
                await supabase.from("continue_watching").upsert(
                    {
                        user_id: user.id,
                        tmdb_id: newItem.tmdbId,
                        media_type: newItem.mediaType,
                        title: newItem.title,
                        poster_path: newItem.posterPath,
                        season: newItem.season,
                        episode: newItem.episode,
                        timestamp: new Date(newItem.timestamp).toISOString(),
                    },
                    {
                        onConflict: "user_id,tmdb_id,media_type",
                    }
                );
            } catch (error) {
                console.error("Failed to save continue watching item:", error);
            }
        },
        [user?.id]
    );

    // Remove item
    const removeItem = useCallback(
        async (tmdbId: number, mediaType: "movie" | "tv") => {
            // Optimistic update
            setItems((prev) =>
                prev.filter((item) => !(item.tmdbId === tmdbId && item.mediaType === mediaType))
            );

            if (!user?.id || !isSupabaseConfigured) {
                // Guest mode: update localStorage
                const localItems = getLocalItems();
                const updated = localItems.filter(
                    (item) => !(item.tmdbId === tmdbId && item.mediaType === mediaType)
                );
                saveLocalItems(updated);
                return;
            }

            // Authenticated: delete from Supabase (realtime will handle the update)
            try {
                await supabase
                    .from("continue_watching")
                    .delete()
                    .eq("user_id", user.id)
                    .eq("tmdb_id", tmdbId)
                    .eq("media_type", mediaType);
            } catch (error) {
                console.error("Failed to remove continue watching item:", error);
            }
        },
        [user?.id]
    );

    // Clear all items
    const clearAll = useCallback(async () => {
        setItems([]);

        if (!user?.id || !isSupabaseConfigured) {
            localStorage.removeItem(LOCAL_STORAGE_KEY);
            return;
        }

        try {
            await supabase.from("continue_watching").delete().eq("user_id", user.id);
        } catch (error) {
            console.error("Failed to clear continue watching items:", error);
        }
    }, [user?.id]);

    // Migrate local items to Supabase (called on login)
    const migrateLocalToSupabase = useCallback(async () => {
        if (!user?.id || !isSupabaseConfigured) return;

        const localItems = getLocalItems();
        if (localItems.length === 0) return;

        try {
            // Insert local items to Supabase
            const rows = localItems.map((item) => ({
                user_id: user.id,
                tmdb_id: item.tmdbId,
                media_type: item.mediaType,
                title: item.title,
                poster_path: item.posterPath,
                season: item.season,
                episode: item.episode,
                timestamp: new Date(item.timestamp).toISOString(),
            }));

            await supabase.from("continue_watching").upsert(rows, {
                onConflict: "user_id,tmdb_id,media_type",
            });

            // Clear local storage after successful migration
            localStorage.removeItem(LOCAL_STORAGE_KEY);

            // Reload items from Supabase
            const { data, error } = await supabase
                .from("continue_watching")
                .select("*")
                .eq("user_id", user.id)
                .order("timestamp", { ascending: false })
                .limit(MAX_ITEMS);

            if (!error && data) {
                const mappedItems = data.map(mapRowToItem);
                setItems(mappedItems);
            }
        } catch (error) {
            console.error("Failed to migrate continue watching items:", error);
        }
    }, [user?.id]);

    const value = useMemo(
        () => ({
            items,
            isLoading,
            saveItem,
            removeItem,
            clearAll,
            migrateLocalToSupabase,
        }),
        [items, isLoading, saveItem, removeItem, clearAll, migrateLocalToSupabase]
    );

    return (
        <ContinueWatchingContext.Provider value={value}>
            {children}
        </ContinueWatchingContext.Provider>
    );
}

// Hook to use the context
export function useContinueWatching() {
    const context = useContext(ContinueWatchingContext);
    if (!context) {
        throw new Error("useContinueWatching must be used within ContinueWatchingProvider");
    }
    return context;
}

// Standalone function to save item (for use outside React components)
export async function saveContinueWatchingItem(
    item: Omit<ContinueWatchingItem, "timestamp">,
    userId?: string
): Promise<void> {
    const newItem: ContinueWatchingItem = {
        ...item,
        timestamp: Date.now(),
    };

    if (!userId || !isSupabaseConfigured) {
        // Guest mode: save to localStorage
        const localItems = getLocalItems();
        const updated = dedupeAndReorder(localItems, newItem);
        saveLocalItems(updated);
        return;
    }

    // Authenticated: save to Supabase
    try {
        await supabase.from("continue_watching").upsert(
            {
                user_id: userId,
                tmdb_id: newItem.tmdbId,
                media_type: newItem.mediaType,
                title: newItem.title,
                poster_path: newItem.posterPath,
                season: newItem.season,
                episode: newItem.episode,
                timestamp: new Date(newItem.timestamp).toISOString(),
            },
            {
                onConflict: "user_id,tmdb_id,media_type",
            }
        );
    } catch (error) {
        console.error("Failed to save continue watching item:", error);
    }
}
