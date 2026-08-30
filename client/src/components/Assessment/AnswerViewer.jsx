import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

/**
 * HighlightOverlay renders a semi-transparent highlight box
 * over an answer region using normalized (0-1) coordinates.
 */
function HighlightOverlay({ regions, currentPage }) {
  const pageRegions = regions.filter((r) => r.pageNumber === currentPage);
  if (pageRegions.length === 0) return null;

  return (
    <>
      {pageRegions.map((region, index) => (
        <div
          key={index}
          className="absolute highlight-box pointer-events-none"
          style={{
            left: `${region.x * 100}%`,
            top: `${region.y * 100}%`,
            width: `${region.width * 100}%`,
            height: `${region.height * 100}%`,
          }}
        />
      ))}
    </>
  );
}

/**
 * Get the image URL for a given page from regions.
 */
const getPageImageUrl = (regions, pageNumber, baseUrl) => {
  const region = regions.find((r) => r.pageNumber === pageNumber);
  if (!region) return null;
  if (!region.imageUrl) return null;
  // If the imageUrl is already absolute, use as-is; otherwise prepend API_URL
  if (region.imageUrl.startsWith('http')) return region.imageUrl;
  return `${baseUrl}${region.imageUrl}`;
};

/**
 * Get distinct sorted page numbers from regions
 */
const getPages = (regions) => {
  const pages = [...new Set(regions.map((r) => r.pageNumber))].sort((a, b) => a - b);
  return pages;
};

export default function AnswerViewer({ selectedMapping }) {
  const [zoom, setZoom] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [imgError, setImgError] = useState(false);
  const containerRef = useRef(null);

  const regions = selectedMapping?.answerRegions || [];
  const pages = getPages(regions);

  // When selection changes, auto-navigate to first page with content
  useEffect(() => {
    setImgError(false);
    if (pages.length > 0) {
      setCurrentPage(pages[0]);
    }
  }, [selectedMapping?.id]);

  const imageUrl = getPageImageUrl(regions, currentPage, API_URL);

  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.25, 3));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 0.25, 0.5));
  const handleFitScreen = () => setZoom(1);

  if (!selectedMapping) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-400">
        <div className="text-center">
          <div className="text-5xl mb-3">📄</div>
          <p className="text-sm">Select a question to view the answer region</p>
        </div>
      </div>
    );
  }

  if (selectedMapping.answerStatus === 'unanswered') {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center card p-8">
          <div className="text-5xl mb-3">—</div>
          <p className="text-lg font-semibold text-slate-700 mb-1">Not Answered</p>
          <p className="text-sm text-slate-400">
            No answer was detected for {selectedMapping.questionDisplayLabel} in the answer sheet.
          </p>
        </div>
      </div>
    );
  }

  if (!imageUrl || regions.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-400">
        <div className="text-center">
          <div className="text-5xl mb-3">🔍</div>
          <p className="text-sm">No image preview available for this answer</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-slate-200">
        <div className="flex items-center gap-1">
          <button onClick={handleZoomOut} className="p-1.5 rounded hover:bg-slate-100 text-slate-600" title="Zoom out">
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-xs text-slate-600 w-10 text-center">{Math.round(zoom * 100)}%</span>
          <button onClick={handleZoomIn} className="p-1.5 rounded hover:bg-slate-100 text-slate-600" title="Zoom in">
            <ZoomIn className="w-4 h-4" />
          </button>
          <button onClick={handleFitScreen} className="p-1.5 rounded hover:bg-slate-100 text-slate-600 ml-1" title="Fit screen">
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>

        {/* Page navigation */}
        {pages.length > 1 && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(pages[pages.indexOf(currentPage) - 1])}
              disabled={pages.indexOf(currentPage) === 0}
              className="p-1.5 rounded hover:bg-slate-100 text-slate-600 disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs text-slate-600">
              Page {currentPage} of {pages.length} answer pages
            </span>
            <button
              onClick={() => setCurrentPage(pages[pages.indexOf(currentPage) + 1])}
              disabled={pages.indexOf(currentPage) === pages.length - 1}
              className="p-1.5 rounded hover:bg-slate-100 text-slate-600 disabled:opacity-40"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Page thumbnail indicators */}
        {pages.length > 1 && (
          <div className="flex items-center gap-1">
            {pages.map((p) => (
              <button
                key={p}
                onClick={() => setCurrentPage(p)}
                className={`w-6 h-6 rounded text-xs font-medium transition-colors ${
                  currentPage === p
                    ? 'bg-primary-500 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Image viewer */}
      <div ref={containerRef} className="flex-1 overflow-auto flex items-start justify-center p-4">
        <div
          className="relative inline-block shadow-elevated rounded-lg overflow-hidden"
          style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }}
        >
          {imgError || imageUrl?.toLowerCase().endsWith('.pdf') ? (
            <object
              data={imageUrl}
              type="application/pdf"
              className="w-[650px] h-[850px] border border-slate-200 rounded-lg shadow-sm"
            >
              <div className="w-[600px] h-[800px] bg-slate-100 flex items-center justify-center rounded-lg">
                <div className="text-center text-slate-400">
                  <div className="text-4xl mb-2">📄</div>
                  <p className="text-sm font-medium text-slate-600">PDF Document View</p>
                  <p className="text-xs mt-1 text-slate-400">Answer text extracted by AI</p>
                </div>
              </div>
            </object>
          ) : (
            <img
              key={`${selectedMapping?.id}-${currentPage}`}
              src={imageUrl}
              alt={`Answer sheet page ${currentPage}`}
              onError={() => setImgError(true)}
              className="max-w-full block"
              style={{ maxWidth: '700px' }}
            />
          )}

          {/* Highlight overlay */}
          <HighlightOverlay regions={regions} currentPage={currentPage} />
        </div>
      </div>

      {/* Multi-page notice */}
      {pages.length > 1 && (
        <div className="px-4 py-2 bg-primary-50 border-t border-primary-100">
          <p className="text-xs text-primary-700 text-center">
            📑 Answer spans {pages.length} pages — use navigation above to view all regions
          </p>
        </div>
      )}
    </div>
  );
}
