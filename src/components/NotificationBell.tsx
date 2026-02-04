import { Link } from "react-router-dom";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNotifications } from "@/hooks/useNotifications";
import { cn } from "@/lib/utils";

export const NotificationBell = () => {
  const { unreadCount } = useNotifications();

  return (
    <Button
      variant="ghost"
      size="icon"
      className="relative rounded-full hover:bg-secondary/50 overflow-visible group"
      asChild
    >
      <Link to="/requests">
        <Bell
          className={cn(
            "w-5 h-5 transition-transform group-hover:scale-110",
            unreadCount > 0 && "animate-pulse text-primary fill-primary/20 scale-110"
          )}
        />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-primary border-2 border-background rounded-full animate-bounce" />
        )}
        <style dangerouslySetInnerHTML={{
          __html: `
          @keyframes pulse-custom {
            0%, 100% { opacity: 1; transform: scale(1.1); }
            50% { opacity: 0.6; transform: scale(0.95); }
          }
          .animate-pulse {
            animation: pulse-custom 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
          }
        `}} />
      </Link>
    </Button>
  );
};
