import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { useAdmin, AdminRequest } from "@/hooks/useAdmin";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { 
  Shield, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  Users,
  FileText,
  Loader2,
  Trash2,
  Plus,
  Crown
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";

const getStatusBadge = (status: AdminRequest['status']) => {
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
  onUpdateStatus 
}: { 
  request: AdminRequest;
  onUpdateStatus: (id: string, status: AdminRequest['status'], response?: string) => Promise<void>;
}) => {
  const [isUpdating, setIsUpdating] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState(request.status);
  const [adminResponse, setAdminResponse] = useState(request.admin_response || '');
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleUpdate = async () => {
    setIsUpdating(true);
    await onUpdateStatus(request.id, selectedStatus, adminResponse);
    setIsUpdating(false);
    setIsDialogOpen(false);
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
              {' • '}
              <span className="text-xs">User ID: {request.user_id.slice(0, 8)}...</span>
            </CardDescription>
          </div>
          {getStatusBadge(request.status)}
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-3">{request.message}</p>
        
        {request.admin_response && (
          <div className="p-3 rounded-md bg-primary/10 border border-primary/20 mb-3">
            <p className="text-xs font-medium text-primary mb-1">Your Response:</p>
            <p className="text-sm">{request.admin_response}</p>
          </div>
        )}

        <div className="flex items-center justify-between mt-4">
          <p className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(request.created_at), { addSuffix: true })}
          </p>
          
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                Update Status
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Update Request</DialogTitle>
                <DialogDescription>
                  Update the status and send a response to the user.
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Status</label>
                  <Select value={selectedStatus} onValueChange={(v) => setSelectedStatus(v as AdminRequest['status'])}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Response to User (optional)</label>
                  <Textarea
                    placeholder="Add a message for the user..."
                    value={adminResponse}
                    onChange={(e) => setAdminResponse(e.target.value)}
                    className="min-h-[100px]"
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleUpdate} disabled={isUpdating}>
                  {isUpdating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    'Update & Notify User'
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardContent>
    </Card>
  );
};

const AdminManagement = () => {
  const { admins, isOwner, addAdmin, removeAdmin } = useAdmin();
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const { toast } = useToast();

  const handleAddAdmin = async () => {
    if (!newAdminEmail.trim()) return;
    
    setIsAdding(true);
    const { error } = await addAdmin(newAdminEmail.trim());
    setIsAdding(false);

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Admin Added",
        description: `${newAdminEmail} has been added as an admin.`,
      });
      setNewAdminEmail('');
    }
  };

  const handleRemoveAdmin = async (userId: string) => {
    setRemovingId(userId);
    const { error } = await removeAdmin(userId);
    setRemovingId(null);

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Admin Removed",
        description: "The admin has been removed.",
      });
    }
  };

  return (
    <div className="space-y-6">
      {isOwner && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Add New Admin</CardTitle>
            <CardDescription>
              Add a user as admin by their email. They must have signed in at least once.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                placeholder="user@example.com"
                value={newAdminEmail}
                onChange={(e) => setNewAdminEmail(e.target.value)}
                className="flex-1"
              />
              <Button onClick={handleAddAdmin} disabled={isAdding || !newAdminEmail.trim()}>
                {isAdding ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    Add
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Current Admins</CardTitle>
          <CardDescription>
            Users with admin access to manage requests
          </CardDescription>
        </CardHeader>
        <CardContent>
          {admins.length === 0 ? (
            <p className="text-sm text-muted-foreground">No admins found.</p>
          ) : (
            <div className="space-y-2">
              {admins.map((admin) => (
                <div 
                  key={admin.id} 
                  className="flex items-center justify-between p-3 rounded-lg bg-secondary/50"
                >
                  <div className="flex items-center gap-3">
                    {admin.is_owner ? (
                      <Crown className="w-5 h-5 text-yellow-500" />
                    ) : (
                      <Shield className="w-5 h-5 text-primary" />
                    )}
                    <div>
                      <p className="text-sm font-medium">
                        {admin.is_owner ? 'Owner' : 'Admin'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        ID: {admin.user_id.slice(0, 8)}...
                      </p>
                    </div>
                  </div>
                  
                  {isOwner && !admin.is_owner && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleRemoveAdmin(admin.user_id)}
                      disabled={removingId === admin.user_id}
                    >
                      {removingId === admin.user_id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

const AdminDashboard = () => {
  const { user } = useAuth();
  const { isAdmin, isOwner, isLoading, allRequests, updateRequestStatus } = useAdmin();
  const { toast } = useToast();

  const handleUpdateStatus = async (id: string, status: AdminRequest['status'], response?: string) => {
    const { error } = await updateRequestStatus(id, status, response);
    
    if (error) {
      toast({
        title: "Error",
        description: "Failed to update request.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Request Updated",
        description: "The user has been notified.",
      });
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 pt-32 text-center">
          <Shield className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
          <h1 className="text-2xl font-bold mb-4">Admin Access Required</h1>
          <p className="text-muted-foreground mb-6">Please sign in to access the admin dashboard.</p>
          <Button asChild>
            <Link to="/auth">Sign In</Link>
          </Button>
        </div>
        <Footer />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 pt-24 pb-12">
          <Skeleton className="h-10 w-48 mb-8" />
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-40 w-full" />
            ))}
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 pt-32 text-center">
          <Shield className="w-16 h-16 mx-auto text-destructive mb-4" />
          <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
          <p className="text-muted-foreground mb-6">You don't have permission to access this page.</p>
          <Button asChild>
            <Link to="/">Go Home</Link>
          </Button>
        </div>
        <Footer />
      </div>
    );
  }

  const pendingCount = allRequests.filter(r => r.status === 'pending').length;
  const inProgressCount = allRequests.filter(r => r.status === 'in_progress').length;

  return (
    <>
      <Helmet>
        <title>Admin Dashboard - DanieWatch</title>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>

      <div className="min-h-screen bg-background">
        <Navbar />

        <div className="container mx-auto px-4 pt-24 pb-12">
          <div className="flex items-center gap-3 mb-2">
            <Shield className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-bold">Admin Dashboard</h1>
            {isOwner && (
              <Badge variant="secondary" className="gap-1">
                <Crown className="w-3 h-3" /> Owner
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground mb-8">
            Manage user requests and admin access
          </p>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{allRequests.length}</div>
                <p className="text-xs text-muted-foreground">Total Requests</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-yellow-500">{pendingCount}</div>
                <p className="text-xs text-muted-foreground">Pending</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-blue-500">{inProgressCount}</div>
                <p className="text-xs text-muted-foreground">In Progress</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-green-500">
                  {allRequests.filter(r => r.status === 'completed').length}
                </div>
                <p className="text-xs text-muted-foreground">Completed</p>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="requests" className="w-full">
            <TabsList className="mb-6">
              <TabsTrigger value="requests" className="gap-2">
                <FileText className="w-4 h-4" />
                Requests
                {pendingCount > 0 && (
                  <Badge variant="destructive" className="ml-1 h-5 w-5 p-0 justify-center">
                    {pendingCount}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="admins" className="gap-2">
                <Users className="w-4 h-4" />
                Admins
              </TabsTrigger>
            </TabsList>

            <TabsContent value="requests">
              {allRequests.length === 0 ? (
                <Card className="text-center py-12">
                  <CardContent>
                    <FileText className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                    <h2 className="text-xl font-semibold mb-2">No requests yet</h2>
                    <p className="text-muted-foreground">
                      When users submit requests, they'll appear here.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {allRequests.map((request) => (
                    <RequestCard
                      key={request.id}
                      request={request}
                      onUpdateStatus={handleUpdateStatus}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="admins">
              <AdminManagement />
            </TabsContent>
          </Tabs>
        </div>

        <Footer />
      </div>
    </>
  );
};

export default AdminDashboard;
