import { Copyright } from "lucide-react";

export const Footer = () => {
  return (
    <footer className="border-t border-border py-6 mt-16">
      <div className="container mx-auto px-4">
        <p className="text-muted-foreground text-sm text-center flex items-center justify-center gap-1.5">
          <Copyright className="w-4 h-4" />
          {new Date().getFullYear()}{" "}
          <span className="font-bold">
            Danie<span className="text-primary">Watch</span>
          </span>
          . Created by{" "}
          <span className="relative text-primary font-semibold animate-pulse">
            Daniyal
            <span className="absolute -bottom-0.5 left-0 w-full h-0.5 bg-gradient-to-r from-primary via-red-400 to-primary rounded-full animate-[pulse_2s_ease-in-out_infinite] shadow-[0_0_10px_hsl(var(--primary)),0_0_20px_hsl(var(--primary))]" />
          </span>
        </p>
      </div>
    </footer>
  );
};
