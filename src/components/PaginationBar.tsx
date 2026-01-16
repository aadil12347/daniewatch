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
    if (clamped !== safePage) onPageChange(clamped);
  };

  const pages = React.useMemo(() => {
    // Windowed pagination: 1 … (p-1) p (p+1) … last
    const last = safeTotal;
    if (last <= 7) return Array.from({ length: last }, (_, i) => i + 1);

    const windowStart = clamp(safePage - 1, 2, last - 1);
    const windowEnd = clamp(safePage + 1, 2, last - 1);

    const core = new Set<number>([1, last, windowStart, safePage, windowEnd]);
    return Array.from(core).sort((a, b) => a - b);
  }, [safePage, safeTotal]);

  if (safeTotal <= 1) return null;

  return (
    <Pagination className={className}>
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            href="#"
            aria-disabled={safePage === 1}
            className={safePage === 1 ? "pointer-events-none opacity-50" : undefined}
            onClick={(e) => {
              e.preventDefault();
              goTo(safePage - 1);
            }}
          />
        </PaginationItem>

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
