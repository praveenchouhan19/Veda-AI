import React, { useState } from 'react';
import QuestionList from '../components/Assessment/QuestionList';
import AnswerViewer from '../components/Assessment/AnswerViewer';
import AnswerDetail from '../components/Assessment/AnswerDetail';
import SummaryPanel from '../components/Assessment/SummaryPanel';
import { LayoutGrid, Info } from 'lucide-react';

export default function AssessmentPage({ assessment, onReset }) {
  const [selectedMapping, setSelectedMapping] = useState(
    assessment.mappings?.[0] || null
  );
  const [activeTab, setActiveTab] = useState('assessment'); // 'assessment' | 'summary'

  const { mappings = [], unmatchedAnswers = [], summary = {}, isDemo } = assessment;

  return (
    <div className="h-[calc(100vh-57px)] flex flex-col">
      {/* Demo banner */}
      {isDemo && (
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-2 flex items-center gap-2">
          <Info className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <p className="text-xs text-amber-700">
            <span className="font-semibold">Demo Mode:</span> Showing sample assessment data. Upload real documents to analyze with AI.
          </p>
        </div>
      )}

      {/* Top bar with tabs + summary chips */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setActiveTab('assessment')}
            className={`text-sm font-medium pb-1 border-b-2 transition-colors ${
              activeTab === 'assessment'
                ? 'text-primary-600 border-primary-500'
                : 'text-slate-500 border-transparent hover:text-slate-700'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <LayoutGrid className="w-3.5 h-3.5" />
              Assessment View
            </span>
          </button>
          <button
            onClick={() => setActiveTab('summary')}
            className={`text-sm font-medium pb-1 border-b-2 transition-colors ${
              activeTab === 'summary'
                ? 'text-primary-600 border-primary-500'
                : 'text-slate-500 border-transparent hover:text-slate-700'
            }`}
          >
            Summary
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-success-500" />
            <span className="text-xs text-slate-600">{summary.answered || 0} answered</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-danger-500" />
            <span className="text-xs text-slate-600">{summary.unanswered || 0} unanswered</span>
          </div>
          {summary.ambiguous > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-warning-500" />
              <span className="text-xs text-slate-600">{summary.ambiguous} review</span>
            </div>
          )}
        </div>
      </div>

      {/* Main content area */}
      {activeTab === 'assessment' ? (
        <div className="flex-1 flex overflow-hidden">
          {/* Left: Question list */}
          <div className="w-72 flex-shrink-0 border-r border-slate-200 overflow-y-auto bg-white">
            <QuestionList
              mappings={mappings}
              unmatchedAnswers={unmatchedAnswers}
              selectedId={selectedMapping?.id}
              onSelect={setSelectedMapping}
            />
          </div>

          {/* Center: Answer sheet viewer with highlight */}
          <div className="flex-1 overflow-hidden flex flex-col bg-slate-100">
            <AnswerViewer selectedMapping={selectedMapping} />
          </div>

          {/* Right: Answer detail panel */}
          <div className="w-80 flex-shrink-0 border-l border-slate-200 overflow-y-auto bg-white">
            <AnswerDetail mapping={selectedMapping} />
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-6">
          <SummaryPanel
            summary={summary}
            mappings={mappings}
            unmatchedAnswers={unmatchedAnswers}
            assessment={assessment}
          />
        </div>
      )}
    </div>
  );
}
