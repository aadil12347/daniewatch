import React from "react";
import { Send, Phone } from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RequestFormDialog } from "@/components/RequestFormDialog";
import { ContactAdminSection } from "@/components/ContactAdminSection";

export interface RequestHelpSheetDefaults {
  title?: string;
  type?: "movie" | "tv";
  tmdbId?: number;
  seasonNumber?: number;
}

interface RequestHelpSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaults?: RequestHelpSheetDefaults;
  /**
   * When opening this sheet inside another Radix Dialog (e.g. details modal),
   * set modal={false} to avoid nested focus-trap issues.
   */
  modal?: boolean;
}

export function RequestHelpSheet({
  open,
  onOpenChange,
  defaults,
  modal = true,
}: RequestHelpSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} modal={modal}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>How can we help?</SheetTitle>
          <SheetDescription>Submit a request or contact us directly</SheetDescription>
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
                defaultTitle={defaults?.title}
                defaultType={defaults?.type}
                defaultTmdbId={defaults?.tmdbId}
                defaultSeason={defaults?.seasonNumber}
                onSuccess={() => onOpenChange(false)}
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
}
