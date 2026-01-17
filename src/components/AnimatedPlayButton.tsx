import * as React from "react";

import { cn } from "@/lib/utils";

export type AnimatedPlayButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  label?: string;
};

/**
 * Animated Play button matching the provided HTML/CSS interaction,
 * using the app's semantic color tokens (no hard-coded colors).
 */
export const AnimatedPlayButton = React.forwardRef<HTMLButtonElement, AnimatedPlayButtonProps>(
  ({ label = "Play", className, ...props }, ref) => {
    return (
      <button
        ref={ref}
        type="button"
        className={cn(
          "group inline-flex items-center gap-0 rounded-[15px] px-4 py-2.5 md:py-2",
          // Match site CTA vibe (red gradient + glow)
          "gradient-red text-foreground shadow-glow",
          "font-black tracking-wide",
          "transition-[transform,opacity,filter] duration-300 ease-in-out",
          "hover:opacity-90 hover:brightness-110 active:scale-[0.95]",
          className
        )}
        {...props}
      >
        {/* svg-wrapper-1 */}
        <span className="grid place-items-center">
          {/* svg-wrapper */}
          <span className="grid place-items-center transition-transform duration-300 ease-in-out group-hover:scale-125 [transition-timing-function:linear]">
            <svg
              viewBox="0 0 384 512"
              aria-hidden="true"
              className={cn(
                "block h-5 w-5 origin-center",
                "fill-foreground/70",
                "transition-[transform,fill] duration-300 ease-in-out",
                "group-hover:translate-x-5 group-hover:scale-110 group-hover:fill-foreground"
              )}
            >
              <path d="M73 39c-14.8-9.1-33.4-9.4-48.5-.9S0 62.6 0 80V432c0 17.4 9.4 33.4 24.5 41.9s33.7 8.1 48.5-.9L361 297c14.3-8.7 23-24.2 23-41s-8.7-32.2-23-41L73 39z" />
            </svg>
          </span>
        </span>

        <span className="ml-1.5 text-base md:text-sm transition-all duration-300 ease-in-out group-hover:opacity-0 [transition-timing-function:linear]">
          {label}
        </span>
      </button>
    );
  }
);
AnimatedPlayButton.displayName = "AnimatedPlayButton";
