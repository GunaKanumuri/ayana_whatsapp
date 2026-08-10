import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * PaginationBar — reusable skip-based pagination control.
 * Usage: <PaginationBar skip={0} limit={50} total={200} onSkip={setSkip} />
 */
export function PaginationBar({ skip, limit, total, onSkip }) {
  const page   = Math.floor(skip / limit) + 1;
  const pages  = Math.max(1, Math.ceil(total / limit));
  const canPrev = skip > 0;
  const canNext = skip + limit < total;

  if (total === 0) return null;

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-ayana-line text-sm text-ayana-secondary">
      <span>
        {Math.min(skip + 1, total)}–{Math.min(skip + limit, total)} of {total}
      </span>
      <div className="flex items-center gap-2">
        <button
          disabled={!canPrev}
          onClick={() => onSkip(Math.max(0, skip - limit))}
          className="p-1.5 rounded-lg border border-ayana-line disabled:opacity-30 hover:bg-ayana-alt transition-colors"
          aria-label="Previous page"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="min-w-[56px] text-center">
          {page} / {pages}
        </span>
        <button
          disabled={!canNext}
          onClick={() => onSkip(skip + limit)}
          className="p-1.5 rounded-lg border border-ayana-line disabled:opacity-30 hover:bg-ayana-alt transition-colors"
          aria-label="Next page"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
