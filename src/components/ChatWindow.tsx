import React, { useEffect, useRef, useState } from 'react';
import { useChat, ChatMessage } from '@/hooks/useChat';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, User, Shield, Pencil, Trash2, X, Check, AlertCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';

interface ChatWindowProps {
    requestId: string;
    role: 'user' | 'admin';
    isClosed: boolean;
    closedBy?: 'user' | 'admin' | null;
}

export const ChatWindow = ({ requestId, role, isClosed, closedBy }: ChatWindowProps) => {
    const { messages, loading, sendMessage, editMessage, deleteMessage } = useChat(requestId);
    const [newMessage, setNewMessage] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editContent, setEditContent] = useState('');
    const [selectedMsgId, setSelectedMsgId] = useState<string | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages]);

    const handleSend = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!newMessage.trim() || isClosed) return;

        setIsSending(true);
        try {
            await sendMessage(newMessage, role);
            setNewMessage('');
        } catch (error) {
            // Error handled in hook
        } finally {
            setIsSending(false);
        }
    };

    const handleEdit = (msg: ChatMessage) => {
        setEditingId(msg.id);
        setEditContent(msg.content);
        setSelectedMsgId(null);
    };

    const handleSaveEdit = async () => {
        if (!editingId || !editContent.trim()) return;
        await editMessage(editingId, editContent);
        setEditingId(null);
        setEditContent('');
    };

    const handleCancelEdit = () => {
        setEditingId(null);
        setEditContent('');
    };

    const handleDelete = async (msgId: string) => {
        await deleteMessage(msgId);
        setSelectedMsgId(null);
    };

    const renderMessage = (msg: ChatMessage, index: number) => {
        const isMe = msg.sender_role === role;
        const isAdminMsg = msg.sender_role === 'admin';
        const isEditing = editingId === msg.id;
        const canModify = isMe && !isClosed; // User can only edit/delete their own messages

        // Show deleted message indicator
        if (msg.is_deleted) {
            // Admin sees deleted messages with indicator, user sees nothing
            if (role === 'admin') {
                return (
                    <div
                        key={msg.id}
                        className={cn(
                            "chat-message-animate flex flex-col max-w-[80%]",
                            isMe ? "ml-auto items-end" : "mr-auto items-start"
                        )}
                        style={{ animationDelay: `${Math.min(index * 0.05, 0.3)}s` }}
                    >
                        <div className={cn(
                            "flex items-center gap-2 mb-1 text-xs",
                            isMe ? "flex-row-reverse" : "flex-row"
                        )}>
                            <span className={cn(
                                "flex items-center justify-center w-5 h-5 rounded-full flex-shrink-0",
                                isAdminMsg ? "bg-red-500/20 text-red-500" : "bg-blue-500/20 text-blue-500"
                            )}>
                                {isAdminMsg ? <Shield className="w-3 h-3" /> : <User className="w-3 h-3" />}
                            </span>
                            <span className="text-muted-foreground opacity-70 text-[10px] md:text-xs">
                                {isAdminMsg ? 'Admin' : 'User'}
                            </span>
                        </div>
                        <div className="px-2.5 md:px-3 py-1.5 md:py-2 rounded-2xl text-xs md:text-sm bg-destructive/10 border border-destructive/20 text-destructive/70 italic flex items-center gap-2">
                            <Trash2 className="w-3 h-3" />
                            <span>Message deleted</span>
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <span className="cursor-help underline decoration-dotted">view original</span>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="max-w-xs bg-black/90 border-white/10">
                                        <p className="text-xs">{msg.content}</p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </div>
                    </div>
                );
            }
            return null; // Users don't see deleted messages
        }

        return (
            <div
                key={msg.id}
                className={cn(
                    "chat-message-animate flex flex-col max-w-[80%] group",
                    isMe ? "ml-auto items-end" : "mr-auto items-start"
                )}
                style={{ animationDelay: `${Math.min(index * 0.05, 0.3)}s` }}
            >
                <div className={cn(
                    "flex items-center gap-2 mb-1 text-xs",
                    isMe ? "flex-row-reverse" : "flex-row"
                )}>
                    <span className={cn(
                        "flex items-center justify-center w-5 h-5 rounded-full flex-shrink-0 transition-transform duration-200 hover:scale-110",
                        isAdminMsg ? "bg-red-500/20 text-red-500" : "bg-blue-500/20 text-blue-500"
                    )}>
                        {isAdminMsg ? <Shield className="w-3 h-3" /> : <User className="w-3 h-3" />}
                    </span>
                    <span className="text-muted-foreground opacity-70 text-[10px] md:text-xs">
                        {isAdminMsg ? 'Admin' : (role === 'admin' ? 'User' : 'You')}
                    </span>
                    <span className="text-[9px] md:text-[10px] text-muted-foreground opacity-50">
                        {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                    </span>
                    {msg.is_edited && (
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <span className="text-[9px] md:text-[10px] text-yellow-500/70 flex items-center gap-0.5 cursor-help">
                                        <Pencil className="w-2.5 h-2.5" />
                                        edited
                                    </span>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-xs bg-black/90 border-white/10">
                                    {role === 'admin' && msg.original_content ? (
                                        <div className="text-xs">
                                            <p className="text-muted-foreground mb-1">Original message:</p>
                                            <p className="text-white">{msg.original_content}</p>
                                        </div>
                                    ) : (
                                        <p className="text-xs">Message was edited</p>
                                    )}
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    )}
                </div>

                {isEditing ? (
                    <div className="flex items-center gap-2 w-full">
                        <Input
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            className="flex-1 text-xs bg-black/30 border-primary/30"
                            autoFocus
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSaveEdit();
                                }
                                if (e.key === 'Escape') handleCancelEdit();
                            }}
                        />
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-green-500" onClick={handleSaveEdit}>
                            <Check className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={handleCancelEdit}>
                            <X className="w-3.5 h-3.5" />
                        </Button>
                    </div>
                ) : (
                    <Popover open={selectedMsgId === msg.id} onOpenChange={(open) => setSelectedMsgId(open ? msg.id : null)}>
                        <PopoverTrigger asChild>
                            <div
                                className={cn(
                                    "px-2.5 md:px-3 py-1.5 md:py-2 rounded-2xl text-xs md:text-sm break-words transition-all duration-200 cursor-pointer",
                                    isMe
                                        ? "bg-primary text-primary-foreground rounded-tr-sm shadow-lg shadow-primary/10 hover:shadow-primary/20"
                                        : "bg-white/10 text-white rounded-tl-sm hover:bg-white/15",
                                    canModify && "hover:ring-2 hover:ring-primary/30"
                                )}
                            >
                                {msg.content}
                            </div>
                        </PopoverTrigger>
                        {canModify && (
                            <PopoverContent side="top" className="w-auto p-1 bg-black/90 border-white/10 flex gap-1">
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-8 px-2 text-xs hover:bg-white/10"
                                    onClick={() => handleEdit(msg)}
                                >
                                    <Pencil className="w-3 h-3 mr-1" />
                                    Edit
                                </Button>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-8 px-2 text-xs text-destructive hover:bg-destructive/10"
                                    onClick={() => handleDelete(msg.id)}
                                >
                                    <Trash2 className="w-3 h-3 mr-1" />
                                    Delete
                                </Button>
                            </PopoverContent>
                        )}
                    </Popover>
                )}
            </div>
        );
    };

    return (
        <div className="chat-window-animate flex flex-col h-[300px] md:h-[400px] border border-white/10 rounded-lg bg-black/20 overflow-hidden backdrop-blur-sm">
            {/* Messages Area */}
            <ScrollArea className="flex-1 p-3 md:p-4">
                {loading ? (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                        <div className="flex items-center gap-1">
                            <span className="chat-loading-dot"></span>
                            <span className="chat-loading-dot"></span>
                            <span className="chat-loading-dot"></span>
                        </div>
                        <span className="ml-3 text-sm">Loading chat...</span>
                    </div>
                ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground opacity-50">
                        <p className="text-sm">No messages yet.</p>
                        <p className="text-xs">Start the conversation below.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {messages.map((msg, index) => renderMessage(msg, index))}
                        <div ref={scrollRef} />
                    </div>
                )}
            </ScrollArea>

            {/* Input Area */}
            <div className="p-2 md:p-3 bg-white/5 border-t border-white/5">
                {isClosed ? (
                    <div className="text-center text-xs md:text-sm text-muted-foreground py-2 flex items-center justify-center gap-2">
                        <Shield className="w-3 h-3 md:w-4 md:h-4" />
                        Chat closed by {closedBy === 'admin' ? 'Admin' : 'User'}
                    </div>
                ) : (
                    <form onSubmit={handleSend} className="flex gap-2">
                        <Input
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            placeholder="Type a message..."
                            className="chat-input-glow bg-black/20 border-white/10 focus-visible:ring-primary/50 text-sm"
                            disabled={isSending}
                        />
                        <Button
                            type="submit"
                            size="icon"
                            disabled={isSending || !newMessage.trim()}
                            className="send-btn-animate bg-primary hover:bg-primary/90 flex-shrink-0 h-9 w-9 md:h-10 md:w-10"
                        >
                            {isSending ? (
                                <div className="flex items-center justify-center">
                                    <span className="chat-loading-dot" style={{ width: '4px', height: '4px' }}></span>
                                    <span className="chat-loading-dot" style={{ width: '4px', height: '4px' }}></span>
                                    <span className="chat-loading-dot" style={{ width: '4px', height: '4px' }}></span>
                                </div>
                            ) : (
                                <Send className="w-3.5 h-3.5 md:w-4 md:h-4" />
                            )}
                        </Button>
                    </form>
                )}
            </div>
        </div>
    );
};
