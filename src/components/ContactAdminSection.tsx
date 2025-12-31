import { MessageCircle, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";

export const ContactAdminSection = () => {
  const handleWhatsApp = () => {
    window.open('https://wa.link/6bcgei', '_blank');
  };

  const handleEmail = () => {
    window.open('mailto:mdaniyalaadil@gmail.com', '_blank');
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Need immediate help? Contact us directly:
      </p>
      
      <div className="space-y-3">
        <Button
          onClick={handleWhatsApp}
          className="w-full bg-[#25D366] hover:bg-[#25D366]/90 text-white"
        >
          <MessageCircle className="w-4 h-4 mr-2" />
          Chat on WhatsApp
        </Button>
        
        <Button
          onClick={handleEmail}
          variant="outline"
          className="w-full"
        >
          <Mail className="w-4 h-4 mr-2" />
          Send Email
        </Button>
      </div>

      <p className="text-xs text-muted-foreground text-center mt-4">
        We typically respond within 24 hours
      </p>
    </div>
  );
};
