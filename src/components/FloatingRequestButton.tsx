import { useState } from "react";
import { MessageSquarePlus, X, Send, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RequestFormDialog } from "./RequestFormDialog";
import { ContactAdminSection } from "./ContactAdminSection";
import { useMedia } from "@/contexts/MediaContext";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

export const FloatingRequestButton = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { currentMedia } = useMedia();
  const { user } = useAuth();

  // Hide for logged-out users and for the owner (owner shouldn't submit requests)
  const OWNER_EMAIL = "mdaniyalaadil@gmail.com";
  if (!user) return null;
  if (user.email === OWNER_EMAIL) return null;

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button
          size="icon"
          className={cn(
            "fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-lg",
            "bg-primary hover:bg-primary/90 text-primary-foreground",
            "transition-all duration-300 hover:scale-110",
            "animate-pulse-glow"
          )}
        >
          <MessageSquarePlus className="w-6 h-6" />
        </Button>
      </SheetTrigger>
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
  );
};
