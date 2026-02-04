import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface ChatMessage {
    id: string;
    request_id: string;
    sender_role: 'user' | 'admin';
    content: string;
    created_at: string;
    read_at?: string | null;
    // Edit/Delete tracking fields
    is_deleted?: boolean;
    deleted_at?: string | null;
    is_edited?: boolean;
    edited_at?: string | null;
    original_content?: string | null;
}

export const useChat = (requestId: string) => {
    const { user } = useAuth();
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Initial Fetch
    useEffect(() => {
        if (!requestId) return;

        const fetchMessages = async () => {
            setLoading(true);
            const { data, error } = await supabase
                .from('request_messages')
                .select('*')
                .eq('request_id', requestId)
                .order('created_at', { ascending: true });

            if (error) {
                console.error('Error fetching messages:', error);
                setError(error.message);
            } else {
                setMessages(data || []);
            }
            setLoading(false);
        };

        fetchMessages();

        // Subscribe to changes (INSERT, UPDATE, DELETE)
        const channel = supabase
            .channel(`chat:${requestId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'request_messages',
                    filter: `request_id=eq.${requestId}`,
                },
                (payload) => {
                    setMessages((prev) => [...prev, payload.new as ChatMessage]);
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'request_messages',
                    filter: `request_id=eq.${requestId}`,
                },
                (payload) => {
                    setMessages((prev) =>
                        prev.map(msg => msg.id === payload.new.id ? payload.new as ChatMessage : msg)
                    );
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [requestId]);

    const markAsRead = async (role: 'user' | 'admin') => {
        if (!user) return;

        // We want to mark messages AS read where sender is NOT me and read_at is null
        // i.e. if I am 'user', I mark 'admin' messages as read.
        const senderToMark = role === 'user' ? 'admin' : 'user';

        // Check if there are any unread messages to avoid unnecessary API calls
        const hasUnread = messages.some(m => m.sender_role === senderToMark && !m.read_at);
        if (!hasUnread) return;

        // Optimistic update
        setMessages(prev => prev.map(msg =>
            (msg.sender_role === senderToMark && !msg.read_at)
                ? { ...msg, read_at: new Date().toISOString() }
                : msg
        ));

        const { error } = await supabase
            .from('request_messages')
            .update({ read_at: new Date().toISOString() })
            .eq('request_id', requestId)
            .eq('sender_role', senderToMark)
            .is('read_at', null);

        if (error) console.error("Error marking messages as read:", error);
    };

    const sendMessage = async (content: string, role: 'user' | 'admin') => {
        if (!user || !content.trim()) return;

        const { error } = await supabase
            .from('request_messages')
            .insert({
                request_id: requestId,
                sender_role: role,
                content: content.trim(),
            });

        if (error) {
            console.error('Error sending message:', error);
            throw error;
        }
    };

    const editMessage = async (messageId: string, newContent: string) => {
        if (!user || !newContent.trim()) return { error: new Error('Invalid input') };

        // Get the original message first
        const originalMessage = messages.find(m => m.id === messageId);
        if (!originalMessage) return { error: new Error('Message not found') };

        // Store original content only on first edit
        const originalToStore = originalMessage.original_content || originalMessage.content;

        const { error } = await supabase
            .from('request_messages')
            .update({
                content: newContent.trim(),
                is_edited: true,
                edited_at: new Date().toISOString(),
                original_content: originalToStore,
            })
            .eq('id', messageId);

        if (error) {
            console.error('Error editing message:', error);
            return { error };
        }

        // Update local state
        setMessages((prev) =>
            prev.map(msg => msg.id === messageId
                ? {
                    ...msg,
                    content: newContent.trim(),
                    is_edited: true,
                    edited_at: new Date().toISOString(),
                    original_content: originalToStore
                }
                : msg
            )
        );

        return { error: null };
    };

    const deleteMessage = async (messageId: string) => {
        if (!user) return { error: new Error('Not authenticated') };

        const { error } = await supabase
            .from('request_messages')
            .update({
                is_deleted: true,
                deleted_at: new Date().toISOString(),
            })
            .eq('id', messageId);

        if (error) {
            console.error('Error deleting message:', error);
            return { error };
        }

        // Update local state
        setMessages((prev) =>
            prev.map(msg => msg.id === messageId
                ? { ...msg, is_deleted: true, deleted_at: new Date().toISOString() }
                : msg
            )
        );

        return { error: null };
    };

    return {
        messages,
        loading,
        error,
        sendMessage,
        editMessage,
        deleteMessage,
        markAsRead,
    };
};
