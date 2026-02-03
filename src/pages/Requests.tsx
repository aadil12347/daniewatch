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
import { FileText, Clock, CheckCircle, XCircle, AlertCircle, Trash2, Loader2, Shield } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useRouteContentReady } from "@/hooks/useRouteContentReady";

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
    <Card className="bg-black/40 backdrop-blur-md border-white/10 hover:bg-white/5 transition-all duration-300">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-lg text-white">{request.title}</CardTitle>
            <CardDescription className="mt-1 flex items-center gap-2 text-xs">
              <span className="px-2 py-0.5 rounded-full bg-white/10 text-white/70 border border-white/5">
                {request.request_type === 'movie' && 'Movie'}
                {request.request_type === 'tv_season' && `Season ${request.season_number}`}
                {request.request_type === 'general' && 'General'}
              </span>
              <span>{formatDistanceToNow(new Date(request.created_at), { addSuffix: true })}</span>
            </CardDescription>
          </div>
          {getStatusBadge(request.status)}
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-gray-300 mb-4 bg-white/5 p-3 rounded-lg border border-white/5">
          {request.message}
        </p>

        {request.admin_response && (
          <div className="p-4 rounded-lg bg-primary/10 border border-primary/20 mb-4">
            <div className="flex items-center gap-2 mb-2 text-primary">
              <Shield className="w-4 h-4" />
              <p className="text-xs font-bold uppercase tracking-wider">Admin Response</p>
            </div>
            <p className="text-sm text-white/90 leading-relaxed">{request.admin_response}</p>
          </div>
        )}

        <div className="flex items-center justify-between mt-4 border-t border-white/10 pt-4">
          <div className="flex items-center gap-2">
            {request.closed_by === 'admin' ? (
              <Badge variant="outline" className="text-xs bg-destructive/10 text-destructive border-destructive/20 gap-1 rounded-md px-2 py-1">
                <Shield className="w-3 h-3" /> Chat Closed by Admin
              </Badge>
            ) : request.closed_by === 'user' ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={handleReopenChat}
                disabled={isReopening}
                className="h-8 text-xs bg-white/10 hover:bg-white/20 text-white border border-white/10"
              >
                {isReopening ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <CheckCircle className="w-3 h-3 mr-1" />}
                Reopen Chat
              </Button>
            ) : (
              <Button
                size="sm"
                variant="ghost"
                onClick={handleCloseChat}
                disabled={isClosing}
                className="h-8 text-xs text-muted-foreground hover:text-white hover:bg-white/10"
              >
                {isClosing ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <XCircle className="w-3 h-3 mr-1" />}
                Close Chat
              </Button>
            )}
          </div>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive hover:bg-destructive/10 -mr-2">
                {isDeleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
                Remove
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-black/90 border-white/10 backdrop-blur-xl">
              <AlertDialogHeader>
                <AlertDialogTitle>Remove from History?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will hide this request from your view. The admin will still have a record of it.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="border-white/10 hover:bg-white/5">Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive text-white hover:bg-destructive/90">
                  Remove
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
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
              {requests.map((request) => (
                <RequestCard
                  key={request.id}
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