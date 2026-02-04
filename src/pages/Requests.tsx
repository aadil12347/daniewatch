import React from "react";
import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";


import { Footer } from "@/components/Footer";
import { useRequests, Request } from "@/hooks/useRequests";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FileText, Clock, CheckCircle, XCircle, AlertCircle, Trash2, Loader2, Shield, ChevronDown, ArrowLeft } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ChatWindow } from "@/components/ChatWindow";
import { useToast } from "@/hooks/use-toast";
import { useRouteContentReady } from "@/hooks/useRouteContentReady";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

const getStatusBadge = (status: Request['status']) => {
  switch (status) {
    case 'pending':
      return <Badge variant="secondary" className="gap-1"><Clock className="w-3 h-3" /> Pending</Badge>;
    case 'in_progress':
      return <Badge variant="default" className="gap-1 bg-blue-500"><AlertCircle className="w-3 h-3" /> In Progress</Badge>;
    case 'completed':
      return <Badge variant="default" className="gap-1 bg-green-500"><CheckCircle className="w-3 h-3" /> Completed</Badge>;
    case 'rejected':
      return <Badge variant="destructive" className="gap-1"><XCircle className="w-3 h-3" /> Rejected</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
};

const RequestCard = ({
  request,
  onDelete,
  onCloseChat,
  onReopenChat
}: {
  request: Request;
  onDelete: (id: string) => Promise<void>;
  onCloseChat: (id: string) => Promise<void>;
  onReopenChat: (id: string) => Promise<void>;
}) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isReopening, setIsReopening] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [lastMessages, setLastMessages] = useState<any[]>([]);

  // Fetch unread messages & last 2 messages
  useEffect(() => {
    const fetchChatData = async () => {
      // Fetch unread
      const { count } = await supabase
        .from('request_messages')
        .select('*', { count: 'exact', head: true })
        .eq('request_id', request.id)
        .eq('sender_role', 'admin')
        .is('read_at', null);

      setUnreadCount(count || 0);

      // Fetch last 2 messages
      const { data: messages } = await supabase
        .from('request_messages')
        .select('content, sender_role, created_at')
        .eq('request_id', request.id)
        .order('created_at', { ascending: false })
        .limit(2);

      if (messages) {
        setLastMessages([...messages].reverse());
      }
    };

    fetchChatData();

    // Subscribe to changes
    const channel = supabase
      .channel(`chat_updates:${request.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'request_messages',
          filter: `request_id=eq.${request.id}`,
        },
        () => {
          fetchChatData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [request.id, isChatOpen]);

  const handleDelete = async () => {
    setIsDeleting(true);
    await onDelete(request.id);
    setIsDeleting(false);
  };

  const handleCloseChat = async () => {
    setIsClosing(true);
    await onCloseChat(request.id);
    setIsClosing(false);
  };

  const handleReopenChat = async () => {
    setIsReopening(true);
    await onReopenChat(request.id);
    setIsReopening(false);
  };

  return (
    <Card className="chat-card-glow bg-black/40 backdrop-blur-md border border-white/10 group hover:bg-white/5 transition-all duration-300">
      <CardHeader className="p-4 cursor-pointer select-none" onClick={() => setIsChatOpen(true)}>
        <div className="flex items-start gap-4">
          {/* Status on the left most side */}
          <div className="flex-shrink-0 pt-0.5">
            {getStatusBadge(request.status)}
          </div>

          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center justify-between gap-4">
              <div className="flex flex-col min-w-0">
                <CardTitle className="text-base md:text-lg font-bold text-white leading-tight truncate">
                  {request.title}
                </CardTitle>
                <div className="flex items-center gap-2 mt-1 whitespace-nowrap overflow-hidden">
                  <span className="text-[10px] md:text-xs px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-gray-400 font-medium">
                    {request.request_type === 'movie' && 'Movie'}
                    {request.request_type === 'tv_season' && `Season ${request.season_number}`}
                    {request.request_type === 'general' && 'General'}
                  </span>
                  <span className="text-gray-600">•</span>
                  <span className="text-[10px] md:text-xs text-gray-500 truncate">
                    {formatDistanceToNow(new Date(request.created_at), { addSuffix: true })}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {!isChatOpen && unreadCount > 0 && (
                  <div className="flex items-center gap-1.5 animate-in fade-in duration-300">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                    </span>
                    <span className="text-[10px] font-bold text-red-400 whitespace-nowrap">
                      {unreadCount} new
                    </span>
                  </div>
                )}
                <ChevronDown className="w-4 h-4 text-gray-600 transition-transform group-hover:text-gray-400" />
              </div>
            </div>

            {/* Chat Preview (Last 2 Messages) */}
            {lastMessages.length > 0 && (
              <div className="mt-3 pt-3 border-t border-white/5 space-y-1.5">
                {lastMessages.map((msg, i) => (
                  <div key={i} className="flex items-start gap-2 text-[11px] md:text-xs text-muted-foreground min-w-0">
                    <span className={cn(
                      "font-bold uppercase tracking-wider flex-shrink-0",
                      msg.sender_role === 'admin' ? "text-cinema-red" : "text-blue-500"
                    )}>
                      {msg.sender_role === 'admin' ? 'Admin:' : 'You:'}
                    </span>
                    <p className="truncate opacity-80 leading-relaxed">{msg.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </CardHeader>

      <Dialog open={isChatOpen} onOpenChange={setIsChatOpen}>
        <DialogContent className="max-w-3xl w-full h-[100dvh] sm:h-[90vh] md:max-h-[90vh] p-0 gap-0 bg-black/95 border-white/10 backdrop-blur-xl flex flex-col overflow-hidden animate-in zoom-in-95 fade-in duration-200">
          <DialogHeader className="p-4 border-b border-white/10 flex-shrink-0 bg-black/40 backdrop-blur-md sticky top-0 z-50">
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-3 min-w-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 sm:hidden flex-shrink-0 -ml-1 text-gray-400 hover:text-white"
                  onClick={() => setIsChatOpen(false)}
                >
                  <ArrowLeft className="w-5 h-5" />
                </Button>
                <div className="flex flex-col min-w-0">
                  <DialogTitle className="text-base sm:text-lg font-bold text-white truncate pr-2">
                    {request.title}
                  </DialogTitle>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(request.status)}
                    <span className="text-[10px] text-gray-500">•</span>
                    <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">
                      {request.request_type === 'movie' ? 'Movie' : (request.request_type === 'tv_season' ? `Season ${request.season_number}` : 'General')}
                    </span>
                  </div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="hidden sm:flex"
                onClick={() => setIsChatOpen(false)}
              >
                <XCircle className="w-5 h-5" />
              </Button>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto flex flex-col min-h-0 bg-black/20">
            <div className="p-4 space-y-4">
              <div className="text-sm text-gray-300 bg-white/5 p-4 rounded-xl border border-white/5 shadow-inner">
                <span className="font-bold text-gray-500 block mb-2 text-[10px] uppercase tracking-[0.2em]">Request Description</span>
                <p className="leading-relaxed opacity-90">{request.message || "No additional details provided."}</p>
              </div>

              {request.admin_response && (
                <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 shadow-sm relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-2 opacity-5">
                    <Shield className="w-12 h-12" />
                  </div>
                  <div className="flex items-center gap-2 mb-2 text-primary">
                    <Shield className="w-4 h-4" />
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em]">Official Admin Response</p>
                  </div>
                  <p className="text-sm text-white/90 leading-relaxed relative z-10">{request.admin_response}</p>
                </div>
              )}

              <div className="h-px bg-white/5 my-6" />

              <ChatWindow
                requestId={request.id}
                role="user"
                isClosed={!!request.closed_by}
                closedBy={request.closed_by}
                className="h-[500px] border-0 rounded-xl bg-black/30 shadow-2xl"
              />
            </div>
          </div>

          <div className="p-4 border-t border-white/10 flex-shrink-0 bg-black/40 backdrop-blur-md sticky bottom-0 z-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {request.closed_by === 'admin' ? (
                  <Badge variant="outline" className="text-[10px] bg-destructive/10 text-destructive border-destructive/20 gap-1 px-3 py-1.5 uppercase tracking-wider font-bold">
                    <Shield className="w-3 h-3" /> Chat Closed by Admin
                  </Badge>
                ) : request.closed_by === 'user' ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={(e) => { e.stopPropagation(); handleReopenChat(); }}
                    disabled={isReopening}
                    className="h-9 px-4 text-xs font-bold uppercase tracking-wider bg-white/10 hover:bg-white/20 text-white border border-white/10 transition-all rounded-full"
                  >
                    {isReopening ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <CheckCircle className="w-3 h-3 mr-2 text-green-400" />}
                    Reopen Chat
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => { e.stopPropagation(); handleCloseChat(); }}
                    disabled={isClosing || request.status === 'completed'}
                    className="h-9 px-4 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-white hover:bg-white/10 rounded-full transition-all"
                  >
                    {isClosing ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <XCircle className="w-3 h-3 mr-2" />}
                    Complete & Close
                  </Button>
                )}
              </div>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-9 px-4 text-xs font-bold uppercase tracking-wider text-destructive hover:text-white hover:bg-destructive/80 rounded-full transition-all" onClick={(e) => e.stopPropagation()}>
                    {isDeleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="bg-black/90 border-white/10 backdrop-blur-xl z-[100] rounded-2xl">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="text-xl font-bold">Delete Request?</AlertDialogTitle>
                    <AlertDialogDescription className="text-gray-400">
                      This will permanently remove this request from your history. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter className="mt-6">
                    <AlertDialogCancel className="bg-white/5 border-white/10 hover:bg-white/10 rounded-full text-xs font-bold uppercase tracking-wider">Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} className="bg-destructive text-white hover:bg-destructive/90 rounded-full text-xs font-bold uppercase tracking-wider px-6">
                      Delete Forever
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

const Requests = () => {
  const { user } = useAuth();
  const { requests, isLoading, deleteRequest, clearAllRequests, closeRequestChat, reopenRequestChat } = useRequests();
  const { toast } = useToast();
  const [isClearing, setIsClearing] = useState(false);

  useRouteContentReady(!user || !isLoading);

  const handleDelete = async (id: string) => {
    const { error } = await deleteRequest(id);
    if (error) {
      toast({
        title: "Error",
        description: "Failed to delete request.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Request Deleted",
        description: "Your request has been removed.",
      });
    }
  };

  const handleClearAll = async () => {
    setIsClearing(true);
    const { error } = await clearAllRequests();
    setIsClearing(false);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to clear requests.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "History Cleared",
        description: "All your requests have been removed.",
      });
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 pt-32 text-center">
          <FileText className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
          <h1 className="text-2xl font-bold mb-4">Sign in to view your requests</h1>
          <p className="text-muted-foreground mb-6">You need to be logged in to see your request history.</p>
          <Button asChild>
            <Link to="/auth">Sign In</Link>
          </Button>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>My Requests - DanieWatch</title>
        <meta name="description" content="View your movie and TV show requests" />
      </Helmet>

      <div className="min-h-screen bg-background">


        <div className="container mx-auto px-4 pt-14 pb-12">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="sr-only">My Requests</h1>
              <p className="text-muted-foreground">
                Track the status of your movie and TV show requests
              </p>
            </div>

            {requests.length > 0 && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" className="text-destructive hover:text-destructive" disabled={isClearing}>
                    {isClearing ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <Trash2 className="w-4 h-4 mr-2" />
                    )}
                    Clear History
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Clear Request History</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete all your requests? This will remove {requests.length} requests and cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleClearAll} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Clear All
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>

          {isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Card key={i}>
                  <CardHeader>
                    <Skeleton className="h-6 w-48" />
                    <Skeleton className="h-4 w-32 mt-2" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-2/3 mt-2" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : requests.length === 0 ? (
            <Card className="text-center py-12">
              <CardContent>
                <FileText className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                <h2 className="text-xl font-semibold mb-2">No requests yet</h2>
                <p className="text-muted-foreground mb-4">
                  You haven't submitted any requests. Click the button in the bottom right corner to request a movie or TV show!
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {requests.map((request, index) => (
                <div key={request.id} className="card-reveal-animate" style={{ animationDelay: `${Math.min(index * 0.05, 0.4)}s` }}>
                  <RequestCard
                    request={request}
                    onDelete={handleDelete}
                    onCloseChat={async (id) => {
                      const { error } = await closeRequestChat(id);
                      if (error) { toast({ title: "Error", description: "Failed to close chat", variant: "destructive" }); }
                    }}
                    onReopenChat={async (id) => {
                      const { error } = await reopenRequestChat(id);
                      if (error) { toast({ title: "Error", description: "Failed to reopen chat", variant: "destructive" }); }
                    }}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        <Footer />
      </div>
    </>
  );
};

export default Requests;