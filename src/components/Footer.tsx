import { Copyright } from "lucide-react";

export const Footer = () => {
  return (
    <footer className="border-t border-border py-6 mt-16">
      <div className="container mx-auto px-4">
        <p className="text-muted-foreground text-sm text-center flex items-center justify-center gap-1.5">
          <Copyright className="w-4 h-4" />
          {new Date().getFullYear()} DanieWatch. Created by Daniyal
        </p>
      </div>
    </footer>
  );
};
