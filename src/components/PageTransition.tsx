import { useEffect, useState, useRef } from "react";
import { cn } from "@/lib/utils";

interface PageTransitionProps {
  children: React.ReactNode;
}

export const PageTransition = ({ children }: PageTransitionProps) => {
  const [displayChildren, setDisplayChildren] = useState(children);
  const [transitionStage, setTransitionStage] = useState<"enter" | "exit">("enter");
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (children !== displayChildren) {
      setTransitionStage("exit");
      
      // Safety fallback: if onAnimationEnd doesn't fire within 250ms, force update
      timeoutRef.current = setTimeout(() => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setDisplayChildren(children);
            setTransitionStage("enter");
          });
        });
      }, 250);
    }
    
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [children, displayChildren]);

  const handleAnimationEnd = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    if (transitionStage === "exit") {
      requestAnimationFrame(() => {
        setDisplayChildren(children);
        setTransitionStage("enter");
      });
    }
  };

  return (
    <div
      className={cn(
        "page-transition",
        transitionStage === "enter" && "page-enter",
        transitionStage === "exit" && "page-exit"
      )}
      onAnimationEnd={handleAnimationEnd}
    >
      {displayChildren}
    </div>
  );
};
