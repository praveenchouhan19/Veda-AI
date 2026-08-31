import React from 'react';
import { ArrowLeft, Bell, ChevronDown, ClipboardList, HelpCircle, Sparkles } from 'lucide-react';

function Avatar({ className = 'w-8 h-8' }) {
  return (
    <span
      className={`${className} shrink-0 rounded-full bg-primary-100 flex items-center justify-center overflow-hidden`}
    >
      <svg viewBox="0 0 32 32" className="w-full h-full" aria-hidden="true">
        <circle cx="16" cy="16" r="16" fill="#ffe4d9" />
        <circle cx="16" cy="13" r="5.5" fill="#3d3d3d" />
        <path d="M5 30c1.6-6 5.8-9 11-9s9.4 3 11 9z" fill="#1c1c1c" />
      </svg>
    </span>
  );
}

/**
 * Top application bar: breadcrumb on the left, utility actions and the
 * signed-in teacher on the right.
 */
export default function TopBar({ onBack, showBack = true, breadcrumb = 'Exams' }) {
  return (
    <header className="flex items-center justify-between gap-4 px-2 sm:px-4 py-3">
      <div className="flex items-center gap-2 min-w-0">
        {showBack && (
          <button type="button" onClick={onBack} className="icon-btn" aria-label="Go back">
            <ArrowLeft className="w-[18px] h-[18px]" />
          </button>
        )}
        <ClipboardList className="w-4 h-4 text-ink-muted shrink-0" />
        <span className="text-sm text-ink-muted truncate">{breadcrumb}</span>
      </div>

      <div className="flex items-center gap-1 sm:gap-2">
        <button type="button" className="icon-btn" aria-label="Help">
          <HelpCircle className="w-[18px] h-[18px]" />
        </button>

        <button type="button" className="icon-btn relative" aria-label="Notifications">
          <Bell className="w-[18px] h-[18px]" />
          <span className="absolute top-1.5 right-2 w-1.5 h-1.5 rounded-full bg-primary-500" />
        </button>

        <button type="button" className="icon-btn" aria-label="AI assistant">
          <Sparkles className="w-[18px] h-[18px]" />
        </button>

        <button
          type="button"
          className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-full transition-colors hover:bg-black/5"
        >
          <Avatar />
          <span className="hidden sm:inline text-sm font-medium">Madhur Rastogi</span>
          <ChevronDown className="hidden sm:inline w-4 h-4 text-ink-muted" />
        </button>
      </div>
    </header>
  );
}
