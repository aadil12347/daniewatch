import React, { useEffect, useRef, useState, useLayoutEffect } from 'react';
import { useChat, ChatMessage } from '@/hooks/useChat';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, User, Shield, Pencil, Trash2, X, Check, CheckCheck } from 'lucide-react';
import { format, isSameDay } from 'date-fns';
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
import './ChatStyles.css'; // Import custom styles

interface ChatWindowProps {
    requestId: string;
    role: 'user' | 'admin';
    isClosed: boolean;
    closedBy?: 'user' | 'admin' | null;
}

export const ChatWindow = ({ requestId, role, isClosed, closedBy }: ChatWindowProps) => {
    const { messages, loading, sendMessage, editMessage, deleteMessage, markAsRead } = useChat(requestId);
    const [newMessage, setNewMessage] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editContent, setEditContent] = useState('');
    const [selectedMsgId, setSelectedMsgId] = useState<string | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Auto-focus input on open
    useEffect(() => {
        const timer = setTimeout(() => {
            inputRef.current?.focus();
        }, 300); // Slight delay for animation
        return () => clearTimeout(timer);
    }, []);

    // Mark messages as read when window is open and messages change
    useEffect(() => {
        if (!loading && messages.length > 0) {
            markAsRead(role);
        }
    }, [messages, loading, role, markAsRead]);

    // Auto-scroll to bottom
    useLayoutEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, loading]);

    const handleSend = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!newMessage.trim() || isClosed) return;

        setIsSending(true);
        try {
            await sendMessage(newMessage, role);
            setNewMessage('');
            // Keep focus on input after sending
            setTimeout(() => inputRef.current?.focus(), 0);
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

    const formatMessageTime = (dateString: string) => {
        return format(new Date(dateString), 'HH:mm');
    };

    const formatMessageFullDate = (dateString: string) => {
        return format(new Date(dateString), 'MMM d, yyyy • HH:mm');
    };

    const renderMessage = (msg: ChatMessage, index: number, prevMsg: ChatMessage | null) => {
        const isMe = msg.sender_role === role;
        const isAdminMsg = msg.sender_role === 'admin';
        const isEditing = editingId === msg.id;
        const canModify = isMe && !isClosed;

        // Date separator logic
        const showDateSeparator = !prevMsg || !isSameDay(new Date(msg.created_at), new Date(prevMsg.created_at));
        const dateSeparator = showDateSeparator ? (
            <div className="flex justify-center my-4 sticky top-2 z-10 opacity-80 hover:opacity-100 transition-opacity">
                <span className="text-[10px] md:text-xs bg-black/60 backdrop-blur-sm px-3 py-1 rounded-full text-muted-foreground border border-white/5 shadow-sm">
                    {format(new Date(msg.created_at), 'MMMM d, yyyy')}
                </span>
            </div>
        ) : null;

        // Show deleted message content (Admin only)
        if (msg.is_deleted) {
            if (role === 'admin') {
                return (
                    <React.Fragment key={msg.id}>
                        {dateSeparator}
                        <div className={cn("flex flex-col max-w-[85%] mb-2 opacity-70", isMe ? "ml-auto items-end" : "mr-auto items-start")}>
                            <div className="px-3 py-2 rounded-lg text-xs md:text-sm bg-destructive/10 border border-destructive/20 text-destructive italic flex items-center gap-2">
                                <Trash2 className="w-3 h-3" />
                                <span>Message deleted</span>
                                {msg.original_content && (
                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <span className="cursor-help underline decoration-dotted ml-1 opacity-80 hover:opacity-100">(show original)</span>
                                            </TooltipTrigger>
                                            <TooltipContent side="top" className="max-w-xs bg-black/90 border-white/10 p-2">
                                                <p className="text-xs text-muted-foreground font-mono mb-1">Original Content:</p>
                                                <p className="text-sm text-white">{msg.original_content}</p>
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                )}
                            </div>
                            <span className="text-[10px] text-muted-foreground mt-1 px-1">{formatMessageFullDate(msg.created_at)}</span>
                        </div>
                    </React.Fragment>
                );
            }
            return null; // Users don't see deleted messages
        }

        return (
            <React.Fragment key={msg.id}>
                {dateSeparator}
                <div
                    className={cn(
                        "chat-message-animate flex flex-col max-w-[85%] md:max-w-[75%] mb-2 group relative",
                        isMe ? "ml-auto items-end" : "mr-auto items-start"
                    )}
                >
                    {/* Role Label (only if different from previous sender) */}
                    {(!prevMsg || prevMsg.sender_role !== msg.sender_role) && (
                        <div className={cn(
                            "flex items-center gap-1 mb-1 text-[10px] px-1 opacity-70",
                            isMe ? "flex-row-reverse" : "flex-row"
                        )}>
                            <span className={cn(
                                "w-1.5 h-1.5 rounded-full",
                                isAdminMsg ? "bg-cinema-red" : "bg-blue-500"
                            )} />
                            <span>{isAdminMsg ? 'Admin' : (role === 'admin' ? 'User' : 'You')}</span>
                        </div>
                    )}

                    {isEditing ? (
                        <div className="flex items-end gap-2 w-full max-w-[300px]">
                            <Input
                                value={editContent}
                                onChange={(e) => setEditContent(e.target.value)}
                                className="flex-1 text-sm bg-black/40 border-primary/50 min-h-[40px]"
                                autoFocus
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSaveEdit();
                                    }
                                    if (e.key === 'Escape') handleCancelEdit();
                                }}
                            />
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-green-500 hover:bg-green-500/10" onClick={handleSaveEdit}>
                                <Check className="w-4 h-4" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={handleCancelEdit}>
                                <X className="w-4 h-4" />
                            </Button>
                        </div>
                    ) : (
                        <Popover open={selectedMsgId === msg.id} onOpenChange={(open) => setSelectedMsgId(open ? msg.id : null)}>
                            <PopoverTrigger asChild>
                                <div
                                    className={cn(
                                        "relative px-3 py-2 md:px-4 md:py-2.5 rounded-2xl text-sm break-words shadow-sm cursor-pointer transition-all active:scale-[0.99]",
                                        isMe
                                            ? "bg-primary text-white rounded-tr-sm"
                                            : "bg-[#2A2A2A] text-gray-100 rounded-tl-sm border border-white/5",
                                        canModify && "hover:brightness-110"
                                    )}
                                >
                                    <div className="mr-8 md:mr-10 pb-1">{msg.content}</div>

                                    {/* Meta info (Time + Ticks) floating bottom-right */}
                                    <div className="absolute bottom-1 right-2 flex items-center gap-1 select-none">
                                        {msg.is_edited && (
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Pencil className="w-2.5 h-2.5 text-white/50" />
                                                    </TooltipTrigger>
                                                    <TooltipContent className="bg-black/90 text-xs">Edited</TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        )}
                                        <span className={cn("text-[9px] md:text-[10px]", isMe ? "text-white/70" : "text-gray-400")}>
                                            {formatMessageTime(msg.created_at)}
                                        </span>
                                        {isMe && (
                                            <span className="flex items-center">
                                                {msg.read_at ? (
                                                    <CheckCheck className="w-3 h-3 text-blue-300 tick-animate" strokeWidth={2.5} />
                                                ) : (
                                                    <Check className="w-3 h-3 text-white/60" strokeWidth={2} />
                                                )}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </PopoverTrigger>
                            <PopoverContent side="top" className="w-auto p-1 bg-black/95 border-white/10 backdrop-blur-xl flex gap-1 shadow-2xl z-50">
                                {canModify ? (
                                    <>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-8 px-3 text-xs hover:bg-white/10"
                                            onClick={() => handleEdit(msg)}
                                        >
                                            <Pencil className="w-3.5 h-3.5 mr-2" />
                                            Edit
                                        </Button>
                                        <div className="w-px h-6 bg-white/10 my-auto" />
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-8 px-3 text-xs text-destructive hover:bg-destructive/10"
                                            onClick={() => handleDelete(msg.id)}
                                        >
                                            <Trash2 className="w-3.5 h-3.5 mr-2" />
                                            Delete
                                        </Button>
                                    </>
                                ) : (
                                    <div className="px-3 py-1.5 text-xs text-muted-foreground">
                                        <p>Sent: {format(new Date(msg.created_at), 'MMM d, h:mm a')}</p>
                                        {msg.read_at && <p className="mt-1 text-blue-400">Read: {format(new Date(msg.read_at), 'h:mm a')}</p>}
                                    </div>
                                )}
                            </PopoverContent>
                        </Popover>
                    )}
                </div>
            </React.Fragment>
        );
    };

    return (
        <div className="chat-window-animate flex flex-col h-[450px] md:h-[500px] border border-white/10 rounded-xl bg-black/40 overflow-hidden backdrop-blur-md shadow-2xl ring-1 ring-white/5">
            {/* Header / Info Bar could go here if needed, simplified for now to keep focus on messages */}

            {/* Messages Area - Flexible height, scrollable */}
            <div className="flex-1 overflow-hidden relative bg-black/40 backdrop-blur-sm">
                {/* Optional subtle background pattern can be added here */}
                <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{
                    backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`,
                    backgroundSize: '20px 20px'
                }}></div>
                <ScrollArea className="h-full w-full pr-0 chat-scrollbar">
                    <div className="p-3 md:p-5 flex flex-col justify-end min-h-full">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
                                <div className="flex items-center gap-1.5">
                                    <span className="chat-loading-dot w-2 h-2 bg-primary/80"></span>
                                    <span className="chat-loading-dot w-2 h-2 bg-primary/80" style={{ animationDelay: "0.2s" }}></span>
                                    <span className="chat-loading-dot w-2 h-2 bg-primary/80" style={{ animationDelay: "0.4s" }}></span>
                                </div>
                                <span className="text-xs uppercase tracking-widest opacity-70">Loading History</span>
                            </div>
                        ) : messages.length === 0 ? (
                            <div className="flex flex-col items-center justify-center flex-1 py-20 text-muted-foreground opacity-50 select-none">
                                <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
                                    <Send className="w-6 h-6 opacity-30 ml-1" />
                                </div>
                                <p className="text-sm font-medium">No messages yet</p>
                                <p className="text-xs mt-1">Start the conversation below</p>
                            </div>
                        ) : (
                            <div className="flex flex-col">
                                {messages.map((msg, index) => renderMessage(msg, index, index > 0 ? messages[index - 1] : null))}
                                <div ref={scrollRef} className="h-2" />
                            </div>
                        )}
                    </div>
                </ScrollArea>
            </div>

            {/* Input Area - Fixed at bottom */}
            <div className="p-3 md:p-4 bg-[#1a1a1a] border-t border-white/10 z-20 shadow-[0_-5px_15px_rgba(0,0,0,0.3)]">
                {isClosed ? (
                    <div className="text-center text-xs md:text-sm text-muted-foreground py-3 flex items-center justify-center gap-2 bg-white/5 rounded-lg border border-dashed border-white/10">
                        <Shield className="w-4 h-4 text-destructive" />
                        <span>Chat closed by {closedBy === 'admin' ? 'Admin' : 'User'}</span>
                    </div>
                ) : (
                    <form onSubmit={handleSend} className="flex gap-3 items-end">
                        <Input
                            ref={inputRef}
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            placeholder="Type a message..."
                            className="flex-1 bg-black/20 border-white/10 focus-visible:ring-primary/50 text-sm min-h-[44px] py-3 rounded-xl chat-input-glow transition-all"
                            disabled={isSending}
                            autoComplete="off"
                        />
                        <Button
                            type="submit"
                            size="icon"
                            disabled={isSending || !newMessage.trim()}
                            className={cn(
                                "h-11 w-11 rounded-xl shadow-lg transition-all duration-300 flex-shrink-0",
                                newMessage.trim() ? "bg-primary hover:bg-primary/90 scale-100" : "bg-white/10 hover:bg-white/20 scale-95 opacity-70"
                            )}
                        >
                            {isSending ? (
                                <div className="flex items-center justify-center gap-0.5">
                                    <span className="w-1 h-1 bg-white rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
                                    <span className="w-1 h-1 bg-white rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                                    <span className="w-1 h-1 bg-white rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                                </div>
                            ) : (
                                <Send className={cn("w-5 h-5", newMessage.trim() ? "translate-x-0.5" : "")} />
                            )}
                        </Button>
                    </form>
                )}
            </div>
        </div>
    );
};
