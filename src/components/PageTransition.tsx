import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

interface PageTransitionProps {
  children: React.ReactNode;
}

export const PageTransition = ({ children }: PageTransitionProps) => {
  const location = useLocation();
  const [displayChildren, setDisplayChildren] = useState(children);
  const [transitionStage, setTransitionStage] = useState<"enter" | "exit">("enter");

  useEffect(() => {
    if (children !== displayChildren) {
      setTransitionStage("exit");
    }
  }, [children, displayChildren]);

  const handleAnimationEnd = () => {
    if (transitionStage === "exit") {
      setDisplayChildren(children);
      setTransitionStage("enter");
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
