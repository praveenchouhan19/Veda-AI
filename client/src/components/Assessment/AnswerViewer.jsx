import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, ImageOff, Minus, Plus } from 'lucide-react';
import { assetUrl } from '../../services/api';

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 3;
const ZOOM_STEP = 0.25;

/**
 * Build the ordered list of answer sheet pages. Prefers the manifest the
 * server sends, and falls back to whatever pages the regions reference so
 * older assessments (and the demo payload) still render.
 */
const derivePages = (assessment) => {
  if (assessment?.answerSheetPages?.length) {
    return [...assessment.answerSheetPages].sort((a, b) => a.pageNumber - b.pageNumber);
  }

  const seen = new Map();
  const allRegions = [
    ...(assessment?.mappings || []).flatMap((m) => m.answerRegions || []),
    ...(assessment?.unmatchedAnswers || []).flatMap((u) => u.regions || []),
  ];

  for (const region of allRegions) {
    if (region?.pageNumber && !seen.has(region.pageNumber)) {
      seen.set(region.pageNumber, { pageNumber: region.pageNumber, imageUrl: region.imageUrl });
    }
  }
  return [...seen.values()].sort((a, b) => a.pageNumber - b.pageNumber);
};

function RegionBox({ ref, region, label, active, onSelect }) {
  const style = {
    left: `${region.x * 100}%`,
    top: `${region.y * 100}%`,
    width: `${region.width * 100}%`,
    height: `${region.height * 100}%`,
  };

  if (!active) {
    return (
      <button
        type="button"
        ref={ref}
        onClick={onSelect}
        aria-label={`Select ${label}`}
        className="absolute rounded border border-dashed border-black/20 transition-colors hover:border-primary-400 hover:bg-primary-500/10"
        style={style}
      />
    );
  }

  return (
    <div ref={ref} className="absolute highlight-box highlight-box-active" style={style}>
      <span className="highlight-label">{label}</span>
    </div>
  );
}

export default function AnswerViewer({ assessment, selectedMapping, onSelectMapping }) {
  const pages = useMemo(() => derivePages(assessment), [assessment]);
  const [pageIndex, setPageIndex] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [imageFailed, setImageFailed] = useState(false);
  const scrollRef = useRef(null);
  const activeBoxRef = useRef(null);

  const currentPage = pages[pageIndex];

  // Follow the selection: jump to the page holding the first highlighted region.
  useEffect(() => {
    const target = selectedMapping?.answerRegions?.[0]?.pageNumber;
    if (!target) return;
    const index = pages.findIndex((p) => p.pageNumber === target);
    if (index >= 0) setPageIndex(index);
  }, [selectedMapping, pages]);

  useEffect(() => {
    setImageFailed(false);
  }, [currentPage?.imageUrl]);

  useEffect(() => {
    activeBoxRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [selectedMapping, pageIndex]);

  // Every region that belongs to the page on screen, selected one included.
  const pageRegions = useMemo(() => {
    if (!currentPage) return [];
    return (assessment?.mappings || []).flatMap((mapping) =>
      (mapping.answerRegions || [])
        .filter((region) => region.pageNumber === currentPage.pageNumber)
        .map((region) => ({ region, mapping }))
    );
  }, [assessment, currentPage]);

  const pageCount = pages.length;
  const spannedPages = selectedMapping
    ? new Set((selectedMapping.answerRegions || []).map((r) => r.pageNumber)).size
    : 0;

  return (
    <section className="h-full min-h-0 flex flex-col bg-canvas-deep rounded-3xl overflow-hidden">
      <header className="shrink-0 flex items-center justify-between gap-3 px-4 py-3 bg-white/70 backdrop-blur border-b border-black/5">
        <h2 className="text-sm font-semibold">Answer Sheet</h2>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-full bg-black/[0.04] px-1 py-0.5">
            <button
              type="button"
              className="icon-btn w-7 h-7"
              onClick={() => setZoom((z) => Math.max(ZOOM_MIN, z - ZOOM_STEP))}
              disabled={zoom <= ZOOM_MIN}
              aria-label="Zoom out"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <span className="w-11 text-center text-xs font-medium tabular-nums">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              className="icon-btn w-7 h-7"
              onClick={() => setZoom((z) => Math.min(ZOOM_MAX, z + ZOOM_STEP))}
              disabled={zoom >= ZOOM_MAX}
              aria-label="Zoom in"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-center gap-1 rounded-full bg-black/[0.04] px-1 py-0.5">
            <button
              type="button"
              className="icon-btn w-7 h-7"
              onClick={() => setPageIndex((i) => Math.max(0, i - 1))}
              disabled={pageIndex === 0}
              aria-label="Previous page"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="px-1 text-xs font-medium whitespace-nowrap">
              Page {pageCount ? pageIndex + 1 : 0} of {pageCount}
            </span>
            <button
              type="button"
              className="icon-btn w-7 h-7"
              onClick={() => setPageIndex((i) => Math.min(pageCount - 1, i + 1))}
              disabled={pageIndex >= pageCount - 1}
              aria-label="Next page"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 min-h-0 overflow-auto p-4">
        {!currentPage || imageFailed ? (
          <div className="h-full flex flex-col items-center justify-center text-center gap-3 text-ink-muted">
            <ImageOff className="w-8 h-8" />
            <p className="text-sm max-w-xs">
              {pageCount === 0
                ? 'No answer sheet pages are available for this assessment.'
                : 'This page image could not be loaded from the server.'}
            </p>
          </div>
        ) : (
          <div className="mx-auto" style={{ width: `${zoom * 100}%`, maxWidth: zoom <= 1 ? '100%' : 'none' }}>
            <div className="relative w-full rounded-xl overflow-hidden bg-white shadow-panel">
              <img
                src={assetUrl(currentPage.imageUrl)}
                alt={`Answer sheet page ${currentPage.pageNumber}`}
                className="block w-full h-auto select-none"
                onError={() => setImageFailed(true)}
              />

              {pageRegions.map(({ region, mapping }, index) => {
                const active = mapping.id === selectedMapping?.id;
                return (
                  <RegionBox
                    key={`${mapping.id}-${index}`}
                    ref={active ? activeBoxRef : null}
                    region={region}
                    label={mapping.questionDisplayLabel || `Q${mapping.questionNumber}`}
                    active={active}
                    onSelect={() => onSelectMapping(mapping)}
                  />
                );
              })}
            </div>
          </div>
        )}
      </div>

      {spannedPages > 1 && (
        <footer className="shrink-0 px-4 py-2 text-xs text-ink-muted bg-white/70 border-t border-black/5">
          This answer spans {spannedPages} pages.
        </footer>
      )}
    </section>
  );
}
