import React from "react";
import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { formatDistanceToNow } from "date-fns";

import { Footer } from "@/components/Footer";
import { useAdmin, AdminRequest } from "@/hooks/useAdmin";
import { useAdminTrash, TrashedRequest } from "@/hooks/useAdminTrash";

import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
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
  Crown,
  Sparkles,
  CheckCheck,
  RotateCcw,
  Archive,
  Link2,
  ExternalLink,
  Ban,
} from "lucide-react";

import { useToast } from "@/hooks/use-toast";
import { BlockedPostsPanel } from "@/components/admin/BlockedPostsPanel";
import { useRouteContentReady } from "@/hooks/useRouteContentReady";

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
  onUpdateStatus,
  onDelete,
  isSelected,
  onSelectChange,
  showCheckbox
}: { 
  request: AdminRequest;
  onUpdateStatus: (id: string, status: AdminRequest['status'], response?: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  isSelected: boolean;
  onSelectChange: (checked: boolean) => void;
  showCheckbox: boolean;
}) => {
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState(request.status);
  const [adminResponse, setAdminResponse] = useState(request.admin_response || '');
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleUpdate = async () => {
    setIsUpdating(true);
    await onUpdateStatus(request.id, selectedStatus, adminResponse);
    setIsUpdating(false);
    setIsDialogOpen(false);
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    await onDelete(request.id);
    setIsDeleting(false);
  };

  return (
    <Card className={isSelected ? "ring-2 ring-primary" : ""}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            {showCheckbox && (
              <Checkbox 
                checked={isSelected}
                onCheckedChange={onSelectChange}
                className="mt-1"
              />
            )}
            <div>
              <CardTitle className="text-lg">{request.title}</CardTitle>
              <CardDescription className="mt-1 space-y-1">
                <div>
                  {request.request_type === 'movie' && 'Movie Request'}
                  {request.request_type === 'tv_season' && `TV Season ${request.season_number || ''} Request`}
                  {request.request_type === 'general' && 'General Request'}
                </div>
                {request.user_email && (
                  <div className="text-xs text-muted-foreground">
                    <span className="font-medium">From:</span> {request.user_email}
                  </div>
                )}
              </CardDescription>
            </div>
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
          
          <div className="flex items-center gap-2">
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

const BlockedPostsManagement = () => {
  return (
    <div className="space-y-6">
      <BlockedPostsPanel />
    </div>
  );
};

const AdminDashboard = () => {
  const { user } = useAuth();
  const {
    isAdmin,
    isOwner,
    isLoading,
    allRequests,
    requestsError,
    updateRequestStatus,
    updateMultipleRequestsStatus,
    deleteRequest,
    deleteRequests,
    refetchRequests,
  } = useAdmin();

  useRouteContentReady(!user || !isLoading);

  const {
    trashedRequests,
    moveToTrash,
    moveMultipleToTrash,
    restoreFromTrash,
    permanentlyDelete,
    permanentlyDeleteMultiple,
    emptyTrash,
  } = useAdminTrash();
  const { toast } = useToast();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [isDeletingSelected, setIsDeletingSelected] = useState(false);
  const [isClearingCategory, setIsClearingCategory] = useState(false);
  const [requestsTab, setRequestsTab] = useState<'new' | 'pending' | 'in_progress' | 'done' | 'trash'>('new');
  
  // Bulk update state
  const [isBulkUpdateOpen, setIsBulkUpdateOpen] = useState(false);
  const [bulkStatus, setBulkStatus] = useState<AdminRequest['status']>('completed');
  const [bulkResponse, setBulkResponse] = useState('');
  const [isUpdatingBulk, setIsUpdatingBulk] = useState(false);

  // Handle bulk status update
  const handleBulkUpdateStatus = async () => {
    if (selectedIds.length === 0) return;
    
    setIsUpdatingBulk(true);
    const { error, count } = await updateMultipleRequestsStatus(
      selectedIds, 
      bulkStatus, 
      bulkResponse.trim() || undefined
    );
    setIsUpdatingBulk(false);

    if (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update requests.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Requests Updated",
        description: `${count} requests have been updated to "${bulkStatus}". Users have been notified.`,
      });
      setSelectedIds([]);
      setIsSelectionMode(false);
      setIsBulkUpdateOpen(false);
      setBulkResponse('');
    }
  };

  const handleUpdateStatus = async (id: string, status: AdminRequest['status'], response?: string) => {
    const { error } = await updateRequestStatus(id, status, response);

    if (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update request.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Request Updated",
        description: "The user has been notified.",
      });
    }
  };

  const handleDeleteRequest = async (id: string) => {
    // Find the request to get its category
    const request = allRequests.find(r => r.id === id);
    if (request) {
      // Determine the category
      let category: 'new' | 'pending' | 'in_progress' | 'done' = 'pending';
      if (request.status === 'pending' && !request.admin_response) category = 'new';
      else if (request.status === 'pending') category = 'pending';
      else if (request.status === 'in_progress') category = 'in_progress';
      else if (request.status === 'completed' || request.status === 'rejected') category = 'done';
      
      // Move to trash first
      moveToTrash(request, category);
    }

    const { error } = await deleteRequest(id);

    if (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete request.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Request Moved to Trash",
        description: "The request has been moved to trash.",
      });
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) return;
    
    // If in trash tab, permanently delete
    if (requestsTab === 'trash') {
      handlePermanentDeleteMultiple();
      return;
    }
    
    setIsDeletingSelected(true);
    
    // Move selected requests to trash first
    const selectedRequests = allRequests.filter(r => selectedIds.includes(r.id));
    if (selectedRequests.length > 0) {
      moveMultipleToTrash(selectedRequests, requestsTab as 'new' | 'pending' | 'in_progress' | 'done');
    }
    
    const { error } = await deleteRequests(selectedIds);
    setIsDeletingSelected(false);

    if (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete requests.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Requests Moved to Trash",
        description: `${selectedIds.length} requests have been moved to trash.`,
      });
      setSelectedIds([]);
      setIsSelectionMode(false);
    }
  };

  // Get category name for display
  const getCategoryLabel = () => {
    switch (requestsTab) {
      case 'new': return 'New';
      case 'pending': return 'Pending';
      case 'in_progress': return 'In Progress';
      case 'done': return 'Done';
      case 'trash': return 'Trash';
      default: return '';
    }
  };

  // Clear current category (move to trash)
  const handleClearCategory = async () => {
    if (requestsTab === 'trash') {
      // Empty trash permanently
      emptyTrash();
      toast({
        title: "Trash Emptied",
        description: "All trashed requests have been permanently deleted.",
      });
      return;
    }

    const requestsToClear = getCurrentRequestsForClear();
    if (requestsToClear.length === 0) return;

    setIsClearingCategory(true);
    
    // Move to trash first
    moveMultipleToTrash(requestsToClear, requestsTab as TrashedRequest['originalCategory']);
    
    // Then delete from database
    const { error } = await deleteRequests(requestsToClear.map(r => r.id));
    setIsClearingCategory(false);

    if (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to clear requests.",
        variant: "destructive",
      });
    } else {
      toast({
        title: `${getCategoryLabel()} Cleared`,
        description: `${requestsToClear.length} requests moved to trash.`,
      });
    }
  };

  // Handle restoring a request from trash
  const handleRestoreFromTrash = (requestId: string) => {
    const restored = restoreFromTrash(requestId);
    if (restored) {
      toast({
        title: "Request Restored",
        description: `"${restored.title}" has been restored.`,
      });
      refetchRequests();
    }
  };

  // Handle permanent delete from trash
  const handlePermanentDelete = (requestId: string) => {
    permanentlyDelete(requestId);
    toast({
      title: "Permanently Deleted",
      description: "The request has been permanently deleted.",
    });
  };

  // Handle permanent delete multiple from trash
  const handlePermanentDeleteMultiple = () => {
    permanentlyDeleteMultiple(selectedIds);
    toast({
      title: "Permanently Deleted",
      description: `${selectedIds.length} requests have been permanently deleted.`,
    });
    setSelectedIds([]);
    setIsSelectionMode(false);
  };

  const toggleSelection = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds((prev) => [...prev, id]);
    } else {
      setSelectedIds((prev) => prev.filter((i) => i !== id));
    }
  };

  const selectAll = (requests: AdminRequest[]) => {
    setSelectedIds(requests.map((r) => r.id));
  };

  const deselectAll = () => {
    setSelectedIds([]);
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
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

  // Filter requests by status (exclude trashed ones from allRequests - they're tracked in localStorage)
  const newRequests = allRequests.filter(r => r.status === 'pending' && !r.admin_response);
  const pendingRequests = allRequests.filter(r => r.status === 'pending');
  const inProgressRequests = allRequests.filter(r => r.status === 'in_progress');
  const doneRequests = allRequests.filter(r => r.status === 'completed' || r.status === 'rejected');

  const getCurrentRequests = (): AdminRequest[] => {
    switch (requestsTab) {
      case 'new': return newRequests;
      case 'pending': return pendingRequests;
      case 'in_progress': return inProgressRequests;
      case 'done': return doneRequests;
      case 'trash': return trashedRequests as AdminRequest[];
      default: return allRequests;
    }
  };

  // Get requests for current category (for clearing)
  const getCurrentRequestsForClear = (): AdminRequest[] => {
    switch (requestsTab) {
      case 'new': return newRequests;
      case 'pending': return pendingRequests;
      case 'in_progress': return inProgressRequests;
      case 'done': return doneRequests;
      default: return [];
    }
  };

  const currentRequests = getCurrentRequests();

  return (
    <>
      <Helmet>
        <title>Admin Dashboard - DanieWatch</title>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>

      <div className="min-h-screen bg-background">
        

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
            <Card className="cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all" onClick={() => setRequestsTab('new')}>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-primary">{newRequests.length}</div>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> New
                </p>
              </CardContent>
            </Card>
            <Card className="cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all" onClick={() => setRequestsTab('pending')}>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-yellow-500">{pendingRequests.length}</div>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Pending
                </p>
              </CardContent>
            </Card>
            <Card className="cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all" onClick={() => setRequestsTab('in_progress')}>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-blue-500">{inProgressRequests.length}</div>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> In Progress
                </p>
              </CardContent>
            </Card>
            <Card className="cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all" onClick={() => setRequestsTab('done')}>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-green-500">{doneRequests.length}</div>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" /> Done
                </p>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="requests" className="w-full">
            <TabsList className="mb-6">
              <TabsTrigger value="requests" className="gap-2">
                <FileText className="w-4 h-4" />
                Requests
                {newRequests.length > 0 && (
                  <Badge variant="destructive" className="ml-1 h-5 w-5 p-0 justify-center">
                    {newRequests.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="links" className="gap-2" asChild>
                <Link to="/admin/update-links">
                  <Link2 className="w-4 h-4" />
                  Update Links
                  <ExternalLink className="w-3 h-3 ml-1" />
                </Link>
              </TabsTrigger>
              <TabsTrigger value="blocked" className="gap-2">
                <Ban className="w-4 h-4" />
                Blocked Posts
              </TabsTrigger>
              <TabsTrigger value="admins" className="gap-2">
                <Users className="w-4 h-4" />
                Admins
              </TabsTrigger>
            </TabsList>

            <TabsContent value="requests">
              {/* Request category tabs */}
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <Button 
                  variant={requestsTab === 'new' ? 'default' : 'outline'} 
                  size="sm"
                  onClick={() => setRequestsTab('new')}
                  className="gap-1"
                >
                  <Sparkles className="w-4 h-4" /> New ({newRequests.length})
                </Button>
                <Button 
                  variant={requestsTab === 'pending' ? 'default' : 'outline'} 
                  size="sm"
                  onClick={() => setRequestsTab('pending')}
                  className="gap-1"
                >
                  <Clock className="w-4 h-4" /> Pending ({pendingRequests.length})
                </Button>
                <Button 
                  variant={requestsTab === 'in_progress' ? 'default' : 'outline'} 
                  size="sm"
                  onClick={() => setRequestsTab('in_progress')}
                  className="gap-1"
                >
                  <AlertCircle className="w-4 h-4" /> In Progress ({inProgressRequests.length})
                </Button>
                <Button 
                  variant={requestsTab === 'done' ? 'default' : 'outline'} 
                  size="sm"
                  onClick={() => setRequestsTab('done')}
                  className="gap-1"
                >
                  <CheckCircle className="w-4 h-4" /> Done ({doneRequests.length})
                </Button>
                <Button 
                  variant={requestsTab === 'trash' ? 'default' : 'outline'} 
                  size="sm"
                  onClick={() => setRequestsTab('trash')}
                  className="gap-1"
                >
                  <Archive className="w-4 h-4" /> Trash ({trashedRequests.length})
                </Button>
              </div>

              {/* Bulk actions */}
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    setIsSelectionMode(!isSelectionMode);
                    if (isSelectionMode) setSelectedIds([]);
                  }}
                >
                  {isSelectionMode ? 'Cancel Selection' : 'Select'}
                </Button>

                {isSelectionMode && (
                  <>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => selectAll(currentRequests)}
                    >
                      <CheckCheck className="w-4 h-4 mr-1" /> Select All
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={deselectAll}
                    >
                      Deselect All
                    </Button>
                    {selectedIds.length > 0 && requestsTab !== 'trash' && (
                      <Dialog open={isBulkUpdateOpen} onOpenChange={setIsBulkUpdateOpen}>
                        <DialogTrigger asChild>
                          <Button variant="default" size="sm" className="gap-1">
                            <CheckCircle className="w-4 h-4" />
                            Update Status ({selectedIds.length})
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Update {selectedIds.length} Requests</DialogTitle>
                            <DialogDescription>
                              Change the status and optionally send a message to all selected users.
                            </DialogDescription>
                          </DialogHeader>
                          
                          <div className="space-y-4 py-4">
                            <div className="space-y-2">
                              <label className="text-sm font-medium">New Status</label>
                              <Select value={bulkStatus} onValueChange={(v) => setBulkStatus(v as AdminRequest['status'])}>
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
                              <label className="text-sm font-medium">Message to All Users (optional)</label>
                              <Textarea
                                placeholder="This message will be sent to all selected users..."
                                value={bulkResponse}
                                onChange={(e) => setBulkResponse(e.target.value)}
                                className="min-h-[100px]"
                              />
                            </div>
                          </div>

                          <DialogFooter>
                            <Button variant="outline" onClick={() => setIsBulkUpdateOpen(false)}>
                              Cancel
                            </Button>
                            <Button onClick={handleBulkUpdateStatus} disabled={isUpdatingBulk}>
                              {isUpdatingBulk ? (
                                <>
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                  Updating...
                                </>
                              ) : (
                                `Update ${selectedIds.length} Requests`
                              )}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    )}
                    {selectedIds.length > 0 && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" size="sm" disabled={isDeletingSelected}>
                            {isDeletingSelected ? (
                              <Loader2 className="w-4 h-4 animate-spin mr-1" />
                            ) : (
                              <Trash2 className="w-4 h-4 mr-1" />
                            )}
                            {requestsTab === 'trash' ? 'Delete Forever' : 'Delete Selected'} ({selectedIds.length})
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              {requestsTab === 'trash' ? 'Permanently Delete Selected' : 'Delete Selected Requests'}
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              {requestsTab === 'trash' 
                                ? `Are you sure you want to permanently delete ${selectedIds.length} selected requests? This cannot be undone.`
                                : `Are you sure you want to move ${selectedIds.length} selected requests to trash?`
                              }
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDeleteSelected} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                              {requestsTab === 'trash' ? 'Delete Forever' : 'Move to Trash'}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </>
                )}

                <div className="ml-auto">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" disabled={isClearingCategory || currentRequests.length === 0}>
                        {isClearingCategory ? (
                          <Loader2 className="w-4 h-4 animate-spin mr-1" />
                        ) : (
                          <Trash2 className="w-4 h-4 mr-1" />
                        )}
                        {requestsTab === 'trash' ? 'Empty Trash' : `Clear ${getCategoryLabel()}`}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          {requestsTab === 'trash' ? 'Empty Trash' : `Clear ${getCategoryLabel()} Requests`}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          {requestsTab === 'trash' 
                            ? `Are you sure you want to permanently delete ${trashedRequests.length} trashed requests? This cannot be undone.`
                            : `Are you sure you want to move ${currentRequests.length} ${getCategoryLabel().toLowerCase()} requests to trash?`
                          }
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleClearCategory} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                          {requestsTab === 'trash' ? 'Empty Trash' : 'Move to Trash'}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>

              {requestsError ? (
                <Card className="text-center py-12">
                  <CardContent>
                    <AlertCircle className="w-16 h-16 mx-auto text-destructive mb-4" />
                    <h2 className="text-xl font-semibold mb-2">Couldn't load requests</h2>
                    <p className="text-muted-foreground mb-4">{requestsError}</p>
                    <Button variant="outline" onClick={refetchRequests}>Retry</Button>
                  </CardContent>
                </Card>
              ) : currentRequests.length === 0 ? (
                <Card className="text-center py-12">
                  <CardContent>
                    {requestsTab === 'trash' ? (
                      <Archive className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                    ) : (
                      <FileText className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                    )}
                    <h2 className="text-xl font-semibold mb-2">
                      {requestsTab === 'trash' ? 'Trash is empty' : 'No requests in this category'}
                    </h2>
                    <p className="text-muted-foreground">
                      {requestsTab === 'new' && "No new requests waiting for review."}
                      {requestsTab === 'pending' && "No pending requests."}
                      {requestsTab === 'in_progress' && "No requests in progress."}
                      {requestsTab === 'done' && "No completed or rejected requests."}
                      {requestsTab === 'trash' && "Deleted requests will appear here for recovery."}
                    </p>
                  </CardContent>
                </Card>
              ) : requestsTab === 'trash' ? (
                <div className="space-y-4">
                  {trashedRequests.map((request) => (
                    <Card key={request.id} className={selectedIds.includes(request.id) ? "ring-2 ring-primary" : ""}>
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3">
                            {isSelectionMode && (
                              <Checkbox 
                                checked={selectedIds.includes(request.id)}
                                onCheckedChange={(checked) => toggleSelection(request.id, !!checked)}
                                className="mt-1"
                              />
                            )}
                            <div>
                              <CardTitle className="text-lg">{request.title}</CardTitle>
                              <CardDescription className="mt-1 space-y-1">
                                <div>
                                  {request.request_type === 'movie' && 'Movie Request'}
                                  {request.request_type === 'tv_season' && `TV Season ${request.season_number || ''} Request`}
                                  {request.request_type === 'general' && 'General Request'}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  <span className="font-medium">Deleted:</span> {formatDistanceToNow(new Date(request.deletedAt), { addSuffix: true })}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  <span className="font-medium">From:</span> {request.originalCategory}
                                </div>
                              </CardDescription>
                            </div>
                          </div>
                          {getStatusBadge(request.status)}
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground mb-3">{request.message}</p>
                        
                        <div className="flex items-center justify-end gap-2 mt-4">
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleRestoreFromTrash(request.id)}
                            className="gap-1"
                          >
                            <RotateCcw className="w-4 h-4" /> Restore
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive gap-1">
                                <Trash2 className="w-4 h-4" /> Delete Forever
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Permanently Delete</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to permanently delete this request? This cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handlePermanentDelete(request.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                  Delete Forever
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  {currentRequests.map((request) => (
                    <RequestCard
                      key={request.id}
                      request={request}
                      onUpdateStatus={handleUpdateStatus}
                      onDelete={handleDeleteRequest}
                      isSelected={selectedIds.includes(request.id)}
                      onSelectChange={(checked) => toggleSelection(request.id, checked)}
                      showCheckbox={isSelectionMode}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="blocked">
              <BlockedPostsManagement />
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