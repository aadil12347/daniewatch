import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface ChatMessage {
    id: string;
    request_id: string;
    sender_role: 'user' | 'admin';
    content: string;
    created_at: string;
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

        // Subscribe to changes
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
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [requestId]);

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

    return {
        messages,
        loading,
        error,
        sendMessage,
    };
};
