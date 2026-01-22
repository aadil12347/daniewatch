import { NavLink as RouterNavLink, NavLinkProps } from "react-router-dom";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { intentPrefetch } from "@/lib/intentPrefetch";

interface NavLinkCompatProps extends Omit<NavLinkProps, "className"> {
  className?: string;
  activeClassName?: string;
  pendingClassName?: string;
}

const NavLink = forwardRef<HTMLAnchorElement, NavLinkCompatProps>(
  ({ className, activeClassName, pendingClassName, to, ...props }, ref) => {
    const toString = (() => {
      try {
        return typeof to === "string" ? to : (to as any)?.pathname ?? "";
      } catch {
        return "";
      }
    })();

    return (
      <RouterNavLink
        ref={ref}
        to={to}
        onMouseEnter={(e) => {
          props.onMouseEnter?.(e);
          intentPrefetch(toString);
        }}
        onFocus={(e) => {
          props.onFocus?.(e);
          intentPrefetch(toString);
        }}
        onTouchStart={(e) => {
          props.onTouchStart?.(e);
          intentPrefetch(toString);
        }}
        className={({ isActive, isPending }) =>
          cn(className, isActive && activeClassName, isPending && pendingClassName)
        }
        {...props}
      />
    );
  },
);

NavLink.displayName = "NavLink";

export { NavLink };
