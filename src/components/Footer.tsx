import { Copyright } from "lucide-react";

export const Footer = () => {
  return (
    <footer className="border-t border-border py-6 mt-16">
      <div className="container mx-auto px-4">
        <p className="text-muted-foreground text-sm text-center flex items-center justify-center gap-1.5">
          <Copyright className="w-4 h-4" />
          {new Date().getFullYear()}{" "}
          <span className="font-bold">
            <span className="text-foreground">Danie</span><span className="text-primary">Watch</span>
          </span>
          . Created by{" "}
          <span className="relative text-primary font-semibold animate-[creator-glow_2s_ease-in-out_infinite]">
            Daniyal
            <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-full h-4 bg-primary/60 blur-xl rounded-full animate-[glow-pulse-up_2s_ease-in-out_infinite]" />
          </span>
        </p>
      </div>
    </footer>
  );
};
