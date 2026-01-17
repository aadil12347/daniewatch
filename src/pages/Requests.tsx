import { useState } from "react";
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
import { FileText, Clock, CheckCircle, XCircle, AlertCircle, Trash2, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";

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
  onDelete 
}: { 
  request: Request;
  onDelete: (id: string) => Promise<void>;
}) => {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    await onDelete(request.id);
    setIsDeleting(false);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-lg">{request.title}</CardTitle>
            <CardDescription className="mt-1">
              {request.request_type === 'movie' && 'Movie Request'}
              {request.request_type === 'tv_season' && `TV Season ${request.season_number || ''} Request`}
              {request.request_type === 'general' && 'General Request'}
            </CardDescription>
          </div>
          {getStatusBadge(request.status)}
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-3">{request.message}</p>
        
        {request.admin_response && (
          <div className="p-3 rounded-md bg-secondary/50 border border-border mb-3">
            <p className="text-xs font-medium text-muted-foreground mb-1">Admin Response:</p>
            <p className="text-sm">{request.admin_response}</p>
          </div>
        )}

        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Submitted {formatDistanceToNow(new Date(request.created_at), { addSuffix: true })}
          </p>
          
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive">
                {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Request</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete this request? This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Delete
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
  const { requests, isLoading, deleteRequest, clearAllRequests } = useRequests();
  const { toast } = useToast();
  const [isClearing, setIsClearing] = useState(false);

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
        

        <div className="container mx-auto px-4 pt-24 pb-12">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold mb-2">My Requests</h1>
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
                <RequestCard key={request.id} request={request} onDelete={handleDelete} />
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