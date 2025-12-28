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
          <span className="relative text-primary font-semibold">
            Daniyal
            <span className="absolute -bottom-1 left-0 w-full h-[3px] rounded-full overflow-hidden">
              <span className="absolute h-full w-1/3 bg-gradient-to-r from-transparent via-primary to-transparent blur-[2px] shadow-[0_0_15px_hsl(0,84%,60%),0_0_30px_hsl(0,84%,60%)] animate-[glow-slide_1.5s_ease-in-out_infinite]" />
            </span>
          </span>
        </p>
      </div>
    </footer>
  );
};
