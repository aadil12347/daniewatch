import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MessageSquarePlus, Send, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RequestFormDialog } from "./RequestFormDialog";
import { ContactAdminSection } from "./ContactAdminSection";
import { useMedia } from "@/contexts/MediaContext";
import { useAuth } from "@/contexts/AuthContext";
import { useAdmin } from "@/hooks/useAdmin";
import { cn } from "@/lib/utils";

export const FloatingRequestButton = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { currentMedia } = useMedia();
  const { user } = useAuth();
  const { isAdmin, isOwner } = useAdmin();
  const navigate = useNavigate();

  // Hide for admin/owner only
  if (isAdmin || isOwner) return null;

  const handleButtonClick = () => {
    if (!user) {
      // Redirect non-authenticated users to signup
      navigate("/auth");
      return;
    }
    setIsOpen(true);
  };

  return (
    <>
      {/* Floating Button */}
      <Button
        size="icon"
        onClick={handleButtonClick}
        data-tutorial="request"
        className={cn(
          "fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-lg",
          "bg-primary hover:bg-primary/90 text-primary-foreground",
          "transition-all duration-300 hover:scale-110",
          "animate-pulse-glow"
        )}
      >
        <MessageSquarePlus className="w-6 h-6" />
      </Button>

      {/* Sheet for authenticated users */}
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>How can we help?</SheetTitle>
          <SheetDescription>
            Submit a request or contact us directly
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6">
          <Tabs defaultValue="request" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="request" className="flex items-center gap-2">
                <Send className="w-4 h-4" />
                Request
              </TabsTrigger>
              <TabsTrigger value="contact" className="flex items-center gap-2">
                <Phone className="w-4 h-4" />
                Contact
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="request" className="mt-4">
              <RequestFormDialog
                defaultTitle={currentMedia?.title}
                defaultType={currentMedia?.type}
                defaultSeason={currentMedia?.seasonNumber}
                onSuccess={() => setIsOpen(false)}
              />
            </TabsContent>
            
            <TabsContent value="contact" className="mt-4">
              <ContactAdminSection />
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
      </Sheet>
    </>
  );
};
