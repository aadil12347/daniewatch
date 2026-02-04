import React, { useEffect } from "react";
import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { formatDistanceToNow } from "date-fns";

import { Footer } from "@/components/Footer";
import { useAdmin, AdminRequest } from "@/hooks/useAdmin";
import { useAdminTrash, TrashedRequest } from "@/hooks/useAdminTrash";
import { markAdminSession } from "@/hooks/useSessionCacheManager";

import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Link, useLocation, useNavigate } from "react-router-dom";
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
  ChevronDown,
  Film,
  Tv,
} from "lucide-react";



import { useToast } from "@/hooks/use-toast";
import { BlockedPostsPanel } from "@/components/admin/BlockedPostsPanel";
import { useRouteContentReady } from "@/hooks/useRouteContentReady";
import { ChatWindow } from "@/components/ChatWindow";

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
  showCheckbox,
  onCloseChat,
  onReopenChat,
  onMarkAsSeen
}: {
  request: AdminRequest;
  onUpdateStatus: (id: string, status: AdminRequest['status'], response?: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onCloseChat: (id: string) => Promise<void>;
  onReopenChat: (id: string) => Promise<void>;
  onMarkAsSeen: (id: string) => Promise<void>;
  isSelected: boolean;
  onSelectChange: (checked: boolean) => void;
  showCheckbox: boolean;
}) => {
  const [isUpdating, setIsUpdating] = useState(false);

  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState(request.status);
  const [adminResponse, setAdminResponse] = useState(request.admin_response || '');
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Fetch unread messages (FROM USER)
  useEffect(() => {
    const fetchUnread = async () => {
      const { count } = await supabase
        .from('request_messages')
        .select('*', { count: 'exact', head: true })
        .eq('request_id', request.id)
        .eq('sender_role', 'user') // Admin needs to see unread messages from USER
        .is('read_at', null);

      setUnreadCount(count || 0);
    };

    fetchUnread();

    const channel = supabase
      .channel(`unread_admin:${request.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'request_messages',
          filter: `request_id=eq.${request.id}`,
        },
        () => fetchUnread()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [request.id, isOpen]);

  const location = useLocation();
  const navigate = useNavigate();
  const meta = request.request_meta ?? null;

  // Generate poster URL from TMDB
  const posterUrl = meta?.tmdb_id && meta?.media_type
    ? `https://image.tmdb.org/t/p/w92/${meta.tmdb_id}`
    : null;

  const handlePosterClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (meta?.tmdb_id && meta?.media_type) {
      const path = meta.media_type === 'movie' ? `/movie/${meta.tmdb_id}` : `/tv/${meta.tmdb_id}`;
      navigate(path, { state: { backgroundLocation: location } });
    }
  };

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
    <div className={`chat-card-glow transition-all duration-300 border rounded-xl overflow-hidden ${isSelected ? "ring-2 ring-primary border-primary/50" : "border-white/10"}`}>
      <div
        className={`bg-black/40 backdrop-blur-md p-4 cursor-pointer hover:bg-white/5 transition-colors ${isOpen ? 'bg-white/5' : ''} ${!request.is_read ? 'ring-1 ring-cinema-red/50 bg-cinema-red/5' : ''}`}
        onClick={() => {
          setIsOpen(true);
          if (!request.is_read) {
            onMarkAsSeen(request.id);
          }
        }}
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            {showCheckbox && (
              <Checkbox
                checked={isSelected}
                onCheckedChange={onSelectChange}
                onClick={(e) => e.stopPropagation()}
                className="mt-0.5"
              />
            )}

            {/* Poster Thumbnail */}
            {meta?.tmdb_id && request.request_type !== 'general' && (
              <div
                className="relative flex-shrink-0 w-12 h-16 md:w-14 md:h-20 rounded-md overflow-hidden border border-white/10 cursor-pointer hover:border-primary/50 hover:ring-2 hover:ring-primary/20 transition-all group"
                onClick={handlePosterClick}
              >
                {meta.poster_path ? (
                  <img
                    src={`https://image.tmdb.org/t/p/w92${meta.poster_path}`}
                    alt={request.title}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="92" height="138" viewBox="0 0 92 138"><rect fill="%23333" width="92" height="138"/><text fill="%23666" x="50%" y="50%" text-anchor="middle" dy=".3em" font-size="10">No Poster</text></svg>';
                    }}
                  />
                ) : (
                  <div className="w-full h-full bg-black/50 flex items-center justify-center">
                    <Film className="w-5 h-5 text-muted-foreground" />
                  </div>
                )}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <span className="text-[8px] text-white font-medium">View</span>
                </div>
                <div className="absolute bottom-0 left-0 right-0 bg-black/80 px-1 py-0.5">
                  <span className="text-[8px] text-primary font-mono">{meta.tmdb_id}</span>
                </div>
              </div>
            )}

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-1">
                <h3 className="text-lg font-semibold truncate text-white">{request.title}</h3>
                {meta?.tmdb_id && (
                  <Badge variant="outline" className="text-[10px] border-primary/30 text-primary font-mono">
                    #{meta.tmdb_id}
                  </Badge>
                )}
                {getStatusBadge(request.status)}
                {request.is_hidden_from_user && (
                  <Badge variant="outline" className="text-xs border-yellow-500/50 text-yellow-500">Hidden from User</Badge>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  {request.request_type === 'movie' ? <Film className="w-3 h-3" /> : request.request_type === 'tv_season' ? <Tv className="w-3 h-3" /> : <FileText className="w-3 h-3" />}
                  {request.request_type === 'movie' && 'Movie'}
                  {request.request_type === 'tv_season' && `Season ${request.season_number}`}
                  {request.request_type === 'general' && 'General'}
                </span>
                <span>•</span>
                <span>{formatDistanceToNow(new Date(request.created_at), { addSuffix: true })}</span>
                {request.user_email && (
                  <>
                    <span>•</span>
                    <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {request.user_email}</span>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Unread Indicator - Red Dot */}
            {!isOpen && unreadCount > 0 && (
              <div className="flex items-center gap-1.5 animate-in fade-in duration-300">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                </span>
                <span className="text-[10px] font-bold text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded-full border border-red-500/20">
                  {unreadCount} new
                </span>
              </div>
            )}
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground relative">
              <ChevronDown className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>


      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-3xl w-[95vw] h-[90vh] md:h-auto md:max-h-[90vh] p-0 gap-0 bg-black/95 border-white/10 backdrop-blur-xl flex flex-col overflow-hidden">
          <DialogHeader className="p-4 border-b border-white/10 flex-shrink-0">
            <div className="flex items-center gap-3">
              <DialogTitle className="text-lg font-semibold text-white truncate max-w-[70%]">
                {request.title}
              </DialogTitle>
              {getStatusBadge(request.status)}
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-4 flex flex-col min-h-0 bg-black/20">
            <div className="space-y-2 mb-4">
              <h4 className="text-sm font-medium text-muted-foreground">User Message</h4>
              <div className="p-3 rounded-lg bg-white/5 text-sm leading-relaxed">
                {request.message}
              </div>
            </div>

            {request.admin_response && (
              <div className="space-y-2 mb-4">
                <h4 className="text-sm font-medium text-primary">Your Response</h4>
                <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 text-sm leading-relaxed">
                  {request.admin_response}
                </div>
              </div>
            )}

            {/* Chat Window */}
            <div className="flex-1 min-h-0 flex flex-col mb-4">
              <h4 className="text-xs md:text-sm font-medium text-muted-foreground mb-2 md:mb-3">Chat with User</h4>
              <ChatWindow
                requestId={request.id}
                role="admin"
                isClosed={!!request.closed_by}
                closedBy={request.closed_by}
                className="h-full border-0 rounded-none bg-transparent shadow-none"
              />
            </div>

            <div className="flex items-center justify-between pt-3 md:pt-4 border-t border-white/10 mt-auto flex-shrink-0">
              <div className="flex gap-2">
                {request.request_type !== 'general' && meta?.tmdb_id && (
                  <Button
                    size="sm"
                    variant="secondary"
                    className="bg-white/10 hover:bg-white/20"
                    onClick={(e) => {
                      e.stopPropagation();
                      const path = meta.media_type === 'movie' ? `/movie/${meta.tmdb_id}` : `/tv/${meta.tmdb_id}`;
                      navigate(path, { state: { backgroundLocation: location } });
                    }}
                  >
                    <Link2 className="w-4 h-4 mr-2" />
                    View Post
                  </Button>
                )}
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-end mb-2">
                  {request.closed_by && (
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] md:text-xs px-1.5 md:px-2 py-0.5 rounded border ${request.closed_by === 'admin'
                        ? 'bg-destructive/10 text-destructive border-destructive/20'
                        : 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
                        }`}>
                        Chat Closed by {request.closed_by === 'admin' ? 'Admin' : 'User'}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 justify-end">
                  <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" className="bg-cinema-red hover:bg-cinema-red/90 text-white shadow-lg shadow-cinema-red/20">
                        Update Status
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-black/90 border-white/10 backdrop-blur-xl z-[70]">
                      <DialogHeader>
                        <DialogTitle>Update Request</DialogTitle>
                        <DialogDescription>
                          Update status and reply to the user.
                        </DialogDescription>
                      </DialogHeader>

                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Status</label>
                          <Select value={selectedStatus} onValueChange={(v) => setSelectedStatus(v as AdminRequest['status'])}>
                            <SelectTrigger className="bg-white/5 border-white/10">
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
                          <label className="text-sm font-medium">Response (optional)</label>
                          <Textarea
                            placeholder="Type your message..."
                            value={adminResponse}
                            onChange={(e) => setAdminResponse(e.target.value)}
                            className="min-h-[100px] bg-white/5 border-white/10"
                          />
                        </div>
                      </div>

                      <DialogFooter>
                        <Button variant="ghost" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleUpdate} disabled={isUpdating} className="bg-cinema-red hover:bg-cinema-red/90">
                          {isUpdating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : 'Update & Notify'}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

                  {request.closed_by ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onReopenChat(request.id)}
                      className="bg-green-500/10 text-green-500 border-green-500/20 hover:bg-green-500/20"
                    >
                      <CheckCircle className="w-3 h-3 mr-1" /> Reopen Chat
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onCloseChat(request.id)}
                      className="bg-white/5 border-white/10 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/20"
                    >
                      <XCircle className="w-3 h-3 mr-1" /> Close Chat
                    </Button>
                  )}

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive hover:bg-destructive/10">
                        {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="bg-black/90 border-white/10 backdrop-blur-xl z-[80]">
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Request?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This action cannot be undone. User will lose this request from their history.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel className="border-white/10 hover:bg-white/5">Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90 text-white">
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
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
    closeRequestChat,
    reopenRequestChat,
    markRequestAsSeen,
  } = useAdmin();

  // Mark this as an admin session for cache management
  useEffect(() => {
    markAdminSession();
  }, []);

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
  // Logic: "New" = Unread messages OR Not seen yet. "Pending" = Seen, no messages, status pending.
  const isRequestNew = (r: AdminRequest) => (!r.is_read) || ((r.unread_count || 0) > 0);

  const newRequests = allRequests.filter(r => isRequestNew(r));
  const pendingRequests = allRequests.filter(r => r.status === 'pending' && !isRequestNew(r));
  const inProgressRequests = allRequests.filter(r => r.status === 'in_progress' && !isRequestNew(r));
  const doneRequests = allRequests.filter(r => (r.status === 'completed' || r.status === 'rejected') && !isRequestNew(r));

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


        <div className="container mx-auto px-4 pt-14 pb-12">
          <div className="flex items-center gap-3 mb-6">
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cinema-red to-red-500">Admin Dashboard</h1>
            {isOwner && (
              <Badge variant="outline" className="gap-1 border-yellow-500/50 text-yellow-500">
                <Crown className="w-3 h-3" /> Owner
              </Badge>
            )}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <Card
              className={`cursor-pointer transition-all duration-300 ${requestsTab === 'new' ? 'ring-2 ring-cinema-red shadow-[0_0_20px_rgba(220,38,38,0.5)] bg-white/5' : 'hover:ring-2 hover:ring-primary/50 hover:bg-white/5'}`}
              onClick={() => setRequestsTab('new')}
            >
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-primary">{newRequests.length}</div>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> New
                </p>
              </CardContent>
            </Card>
            <Card
              className={`cursor-pointer transition-all duration-300 ${requestsTab === 'pending' ? 'ring-2 ring-cinema-red shadow-[0_0_20px_rgba(220,38,38,0.5)] bg-white/5' : 'hover:ring-2 hover:ring-primary/50 hover:bg-white/5'}`}
              onClick={() => setRequestsTab('pending')}
            >
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-yellow-500">{pendingRequests.length}</div>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Pending
                </p>
              </CardContent>
            </Card>
            <Card
              className={`cursor-pointer transition-all duration-300 ${requestsTab === 'in_progress' ? 'ring-2 ring-cinema-red shadow-[0_0_20px_rgba(220,38,38,0.5)] bg-white/5' : 'hover:ring-2 hover:ring-primary/50 hover:bg-white/5'}`}
              onClick={() => setRequestsTab('in_progress')}
            >
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-blue-500">{inProgressRequests.length}</div>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> In Progress
                </p>
              </CardContent>
            </Card>
            <Card
              className={`cursor-pointer transition-all duration-300 ${requestsTab === 'done' ? 'ring-2 ring-cinema-red shadow-[0_0_20px_rgba(220,38,38,0.5)] bg-white/5' : 'hover:ring-2 hover:ring-primary/50 hover:bg-white/5'}`}
              onClick={() => setRequestsTab('done')}
            >
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
              {/* Request category tabs - REMOVED (Use Filters at top) */}


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
                  {currentRequests.map((request, index) => (
                    <div key={request.id} className="card-reveal-animate" style={{ animationDelay: `${Math.min(index * 0.05, 0.4)}s` }}>
                      <RequestCard
                        request={request}
                        onUpdateStatus={handleUpdateStatus}
                        onDelete={handleDeleteRequest}
                        onCloseChat={async (id) => {
                          const { error } = await closeRequestChat(id);
                          if (error) {
                            toast({ title: "Error", description: "Failed to close chat", variant: "destructive" });
                          } else {
                            toast({ title: "Success", description: "Chat closed and request completed", variant: "default" });
                          }
                        }}
                        onReopenChat={async (id) => {
                          const { error } = await reopenRequestChat(id);
                          if (error) {
                            toast({ title: "Error", description: "Failed to reopen chat", variant: "destructive" });
                          } else {
                            toast({ title: "Success", description: "Chat reopened", variant: "default" });
                          }
                        }}
                        isSelected={selectedIds.includes(request.id)}
                        onSelectChange={(checked) => toggleSelection(request.id, checked)}
                        showCheckbox={isSelectionMode}
                        onMarkAsSeen={async (id) => await markRequestAsSeen(id)}
                      />
                    </div>
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