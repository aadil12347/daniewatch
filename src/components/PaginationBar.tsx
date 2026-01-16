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

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export const PaginationBar: React.FC<Props> = ({
  page,
  totalPages,
  onPageChange,
  className,
}) => {
  const safeTotal = Math.max(1, totalPages || 1);
  const safePage = clamp(page || 1, 1, safeTotal);

  const goTo = (nextPage: number) => {
    const clamped = clamp(nextPage, 1, safeTotal);
    if (clamped !== safePage) {
      onPageChange(clamped);
      requestAnimationFrame(() => {
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    }
  };

  const pages = React.useMemo(() => {
    const last = safeTotal;
    if (last <= 3) return Array.from({ length: last }, (_, i) => i + 1);

    // Mobile-friendly sliding window:
    // 1-3 => 1 2 3 …
    // 4 => 2 3 4 …
    // 5 => 3 4 5 …
    const start = clamp(safePage - 2, 1, Math.max(1, last - 2));
    return [start, start + 1, start + 2].filter((p) => p >= 1 && p <= last);
  }, [safePage, safeTotal]);

  if (safeTotal <= 1) return null;

  const showTrailingEllipsis = pages[pages.length - 1] < safeTotal;

  return (
    <Pagination className={className}>
      <PaginationContent className="flex-wrap justify-center gap-1 sm:gap-2">
        {safePage > 1 && (
          <PaginationItem>
            <PaginationPrevious
              href="#"
              className="px-2 sm:px-3 [&>span]:hidden sm:[&>span]:inline"
              onClick={(e) => {
                e.preventDefault();
                goTo(safePage - 1);
              }}
            />
          </PaginationItem>
        )}

        {pages.map((p) => (
          <PaginationItem key={p}>
            <PaginationLink
              href="#"
              isActive={p === safePage}
              className="h-9 w-9 px-0"
              onClick={(e) => {
                e.preventDefault();
                goTo(p);
              }}
            >
              {p}
            </PaginationLink>
          </PaginationItem>
        ))}

        {showTrailingEllipsis && (
          <PaginationItem>
            <PaginationEllipsis />
          </PaginationItem>
        )}

        <PaginationItem>
          <PaginationNext
            href="#"
            aria-disabled={safePage === safeTotal}
            className={
              (safePage === safeTotal ? "pointer-events-none opacity-50 " : "") +
              "px-2 sm:px-3 [&>span]:hidden sm:[&>span]:inline"
            }
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

