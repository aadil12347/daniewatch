"use client";

import * as React from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";

import { cn } from "@/lib/utils";

const transition = {
  type: "spring" as const,
  mass: 0.5,
  damping: 14,
  stiffness: 140,
};

export function Menu({
  setActive,
  children,
  className,
}: {
  setActive: (item: string | null) => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <nav
      onMouseLeave={() => setActive(null)}
      className={cn(
        "relative flex items-center justify-center gap-6 rounded-full border border-border bg-background/40 backdrop-blur-md px-6 py-2",
        className
      )}
    >
      {children}
    </nav>
  );
}

export function MenuItem({
  setActive,
  active,
  item,
  children,
  className,
}: {
  setActive: (item: string) => void;
  active: string | null;
  item: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const open = active === item;

  return (
    <div
      className={cn("relative", className)}
      onMouseEnter={() => setActive(item)}
    >
      <button
        type="button"
        className={cn(
          "nav-link-glow flex items-center gap-2 text-sm font-medium transition-colors",
          open ? "text-foreground" : "text-foreground/70 hover:text-foreground"
        )}
        aria-haspopup={!!children}
        aria-expanded={open}
      >
        {item}
      </button>

      <AnimatePresence>
        {open && children ? (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.99 }}
            transition={transition}
            className="absolute left-1/2 top-full z-50 mt-3 -translate-x-1/2"
          >
            <div className="rounded-2xl border border-border bg-popover text-popover-foreground shadow-card">
              <div className="p-4">{children}</div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export function HoveredLink({
  children,
  to,
  href,
  className,
  ...rest
}: {
  children: React.ReactNode;
  to?: string;
  href?: string;
  className?: string;
} & React.HTMLAttributes<HTMLElement>) {
  const base = cn(
    "block rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-secondary/50 hover:text-foreground transition-colors",
    className
  );

  if (to) {
    return (
      <Link to={to} className={base} {...(rest as any)}>
        {children}
      </Link>
    );
  }

  return (
    <a href={href} className={base} {...(rest as any)}>
      {children}
    </a>
  );
}

export function MenuSectionTitle({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("px-3 pb-2 text-xs font-semibold tracking-wide text-foreground/80", className)}>
      {children}
    </div>
  );
}
