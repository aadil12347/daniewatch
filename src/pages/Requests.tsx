import { Helmet } from "react-helmet-async";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { useRequests, Request } from "@/hooks/useRequests";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, Clock, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

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

const RequestCard = ({ request }: { request: Request }) => {
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

        <p className="text-xs text-muted-foreground">
          Submitted {formatDistanceToNow(new Date(request.created_at), { addSuffix: true })}
        </p>
      </CardContent>
    </Card>
  );
};

const Requests = () => {
  const { user } = useAuth();
  const { requests, isLoading } = useRequests();

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
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
        <Navbar />

        <div className="container mx-auto px-4 pt-24 pb-12">
          <h1 className="text-3xl font-bold mb-2">My Requests</h1>
          <p className="text-muted-foreground mb-8">
            Track the status of your movie and TV show requests
          </p>

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
                <RequestCard key={request.id} request={request} />
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
