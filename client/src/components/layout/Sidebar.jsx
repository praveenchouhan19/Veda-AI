import React from 'react';
import {
  LayoutGrid,
  Presentation,
  FileText,
  ClipboardList,
  PieChart,
  Sparkles,
  PanelLeft,
  ChevronsRight,
} from 'lucide-react';

const NAV_ITEMS = [
  { id: 'home', label: 'Home', icon: LayoutGrid },
  { id: 'classroom', label: 'My Classroom', icon: Presentation },
  { id: 'assignments', label: 'Assignments', icon: FileText },
  { id: 'exams', label: 'Exams', icon: ClipboardList },
  { id: 'library', label: 'My Library', icon: PieChart },
];

function VedaLogo({ className = 'w-8 h-8' }) {
  return (
    <span className={`${className} shrink-0 rounded-lg bg-ink flex items-center justify-center`}>
      <svg viewBox="0 0 24 24" className="w-4 h-4 text-white" aria-hidden="true">
        <path d="M5 5h4l3 9 3-9h4l-5.5 14h-3L5 5z" fill="currentColor" />
      </svg>
    </span>
  );
}

function SchoolBadge() {
  return (
    <span className="w-9 h-9 shrink-0 rounded-full bg-success-100 flex items-center justify-center">
      <svg viewBox="0 0 24 24" className="w-5 h-5 text-success-600" aria-hidden="true">
        <path
          d="M12 3l8 4-8 4-8-4 8-4zM6 11v4c0 1.7 2.7 3 6 3s6-1.3 6-3v-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

/**
 * Left navigation rail. Collapses to an icon-only rail, which is the state the
 * design uses while an assessment is being processed or reviewed.
 */
export default function Sidebar({ collapsed, onToggle, active = 'exams' }) {
  return (
    <aside
      className={`shrink-0 bg-white rounded-3xl shadow-card flex flex-col transition-[width] duration-300 ${
        collapsed ? 'w-[72px] px-3 py-5' : 'w-[232px] p-5'
      }`}
    >
      <div className={`flex items-center ${collapsed ? 'justify-center' : 'justify-between'}`}>
        <div className="flex items-center gap-2">
          <VedaLogo />
          {!collapsed && <span className="font-display text-lg font-semibold">VedaAI</span>}
        </div>
        {!collapsed && (
          <button type="button" onClick={onToggle} className="icon-btn" aria-label="Collapse sidebar">
            <PanelLeft className="w-[18px] h-[18px]" />
          </button>
        )}
      </div>

      <button
        type="button"
        className={`mt-6 flex items-center justify-center gap-2 rounded-full bg-ink text-white ring-2 ring-primary-400 ring-offset-2 transition-colors hover:bg-black ${
          collapsed ? 'w-11 h-11 mx-auto' : 'w-full h-11 px-4'
        }`}
      >
        <Sparkles className="w-4 h-4 text-primary-300" />
        {!collapsed && <span className="text-sm font-medium">AI Teacher&apos;s Toolkit</span>}
      </button>

      <nav className="mt-7 flex-1">
        <ul className="space-y-1">
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
            const isActive = id === active;
            return (
              <li key={id}>
                <button
                  type="button"
                  aria-current={isActive ? 'page' : undefined}
                  title={collapsed ? label : undefined}
                  className={`flex items-center gap-3 rounded-xl text-sm transition-colors ${
                    collapsed ? 'w-11 h-11 mx-auto justify-center' : 'w-full px-3 py-2.5'
                  } ${
                    isActive
                      ? 'bg-black/[0.06] text-ink font-medium'
                      : 'text-ink-muted hover:bg-black/[0.03] hover:text-ink-soft'
                  }`}
                >
                  <Icon className="w-[18px] h-[18px] shrink-0" />
                  {!collapsed && <span>{label}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {collapsed ? (
        <div className="flex flex-col items-center gap-4">
          <SchoolBadge />
          <button type="button" onClick={onToggle} className="icon-btn" aria-label="Expand sidebar">
            <ChevronsRight className="w-[18px] h-[18px]" />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2.5 rounded-2xl bg-black/[0.035] p-2.5">
          <SchoolBadge />
          <div className="min-w-0">
            <p className="text-[13px] font-semibold truncate">Delhi Public School</p>
            <p className="text-[11px] text-ink-muted truncate">Bokaro Steel City</p>
          </div>
        </div>
      )}
    </aside>
  );
}
