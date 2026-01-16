import * as React from "react";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

type Props = {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const PaginationBar: React.FC<Props> = ({ page, totalPages, onPageChange, className }) => {
  const safeTotal = Math.max(1, totalPages || 1);
  const safePage = clamp(page || 1, 1, safeTotal);

  const goTo = (nextPage: number) => {
    const clamped = clamp(nextPage, 1, safeTotal);
    if (clamped !== safePage) {
      onPageChange(clamped);
      // Make the change feel immediate and avoid "stuck on page 1" confusion when user is scrolled down.
      requestAnimationFrame(() => {
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    }
  };

  const pages = React.useMemo(() => {
    // Simple pagination: show only early pages (1 2 3 …) + a small window near the current page.
    const last = safeTotal;
    if (last <= 3) return Array.from({ length: last }, (_, i) => i + 1);

    const start = [1, 2, 3];
    if (safePage <= 3) return start;

    const window = [safePage - 1, safePage, safePage + 1]
      .filter((p) => p >= 4 && p <= last)
      .filter((p, i, arr) => arr.indexOf(p) === i);

    return [...start, ...window];
  }, [safePage, safeTotal]);

  if (safeTotal <= 1) return null;

  return (
    <Pagination className={className}>
      <PaginationContent>
        {safePage > 1 && (
          <PaginationItem>
            <PaginationPrevious
              href="#"
              onClick={(e) => {
                e.preventDefault();
                goTo(safePage - 1);
              }}
            />
          </PaginationItem>
        )}

        {pages.map((p, idx) => {
          const prev = pages[idx - 1];
          const needsEllipsis = prev !== undefined && p - prev > 1;

          return (
            <React.Fragment key={p}>
              {needsEllipsis && (
                <PaginationItem>
                  <PaginationEllipsis />
                </PaginationItem>
              )}
              <PaginationItem>
                <PaginationLink
                  href="#"
                  isActive={p === safePage}
                  onClick={(e) => {
                    e.preventDefault();
                    goTo(p);
                  }}
                >
                  {p}
                </PaginationLink>
              </PaginationItem>
            </React.Fragment>
          );
        })}

        {safeTotal > pages[pages.length - 1] && (
          <PaginationItem>
            <PaginationEllipsis />
          </PaginationItem>
        )}

        <PaginationItem>
          <PaginationNext
            href="#"
            aria-disabled={safePage === safeTotal}
            className={safePage === safeTotal ? "pointer-events-none opacity-50" : undefined}
            onClick={(e) => {
              e.preventDefault();
              goTo(safePage + 1);
            }}
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
};
