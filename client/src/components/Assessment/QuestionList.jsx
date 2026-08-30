import React from 'react';
import { CheckCircle, XCircle, AlertCircle, HelpCircle } from 'lucide-react';

const STATUS_CONFIG = {
  answered: {
    icon: CheckCircle,
    iconClass: 'text-success-500',
    badgeClass: 'badge-answered',
    label: 'Answered',
    dot: 'bg-success-500',
  },
  unanswered: {
    icon: XCircle,
    iconClass: 'text-danger-400',
    badgeClass: 'badge-unanswered',
    label: 'Not Answered',
    dot: 'bg-danger-400',
  },
  ambiguous: {
    icon: AlertCircle,
    iconClass: 'text-warning-500',
    badgeClass: 'badge-ambiguous',
    label: 'Review',
    dot: 'bg-warning-500',
  },
  unmatched: {
    icon: HelpCircle,
    iconClass: 'text-slate-400',
    badgeClass: 'badge-unmatched',
    label: 'Unmatched',
    dot: 'bg-slate-400',
  },
};

function StatusBadge({ status }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.unmatched;
  const Icon = config.icon;
  return (
    <span className={config.badgeClass}>
      <Icon className="w-3 h-3" />
      {config.label}
    </span>
  );
}

function QuestionCard({ mapping, isSelected, onClick }) {
  const config = STATUS_CONFIG[mapping.answerStatus] || STATUS_CONFIG.unmatched;

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3 border-b border-slate-100 transition-all duration-150
        ${isSelected
          ? 'bg-primary-50 border-l-4 border-l-primary-500'
          : 'hover:bg-slate-50 border-l-4 border-l-transparent'
        }`}
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <span className={`text-sm font-bold ${isSelected ? 'text-primary-700' : 'text-slate-800'}`}>
          {mapping.questionDisplayLabel}
        </span>
        <StatusBadge status={mapping.answerStatus} />
      </div>
      <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
        {mapping.questionText}
      </p>
      {mapping.answerStatus === 'answered' && mapping.confidence > 0 && (
        <p className="text-xs text-slate-400 mt-1">
          Confidence: {Math.round(mapping.confidence * 100)}%
        </p>
      )}
    </button>
  );
}

function UnmatchedCard({ answer, isSelected, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3 border-b border-slate-100 transition-all duration-150
        ${isSelected
          ? 'bg-slate-100 border-l-4 border-l-slate-400'
          : 'hover:bg-slate-50 border-l-4 border-l-transparent'
        }`}
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <span className="text-sm font-bold text-slate-600">Unmatched</span>
        <span className="badge-unmatched">
          <HelpCircle className="w-3 h-3" />
          Review
        </span>
      </div>
      <p className="text-xs text-slate-500 line-clamp-2">
        {answer.text || 'Unreadable or unattributed region'}
      </p>
      {answer.regions?.[0] && (
        <p className="text-xs text-slate-400 mt-1">
          Page {answer.regions[0].pageNumber}
        </p>
      )}
    </button>
  );
}

export default function QuestionList({ mappings, unmatchedAnswers, selectedId, onSelect }) {
  const answeredCount = mappings.filter((m) => m.answerStatus === 'answered').length;
  const total = mappings.length;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
        <h3 className="text-sm font-semibold text-slate-800">Questions</h3>
        <p className="text-xs text-slate-500 mt-0.5">{answeredCount}/{total} answered</p>
      </div>

      {/* Question list */}
      <div className="flex-1 overflow-y-auto">
        {mappings.map((mapping) => (
          <QuestionCard
            key={mapping.id}
            mapping={mapping}
            isSelected={selectedId === mapping.id}
            onClick={() => onSelect(mapping)}
          />
        ))}

        {/* Unmatched answers section */}
        {unmatchedAnswers && unmatchedAnswers.length > 0 && (
          <>
            <div className="px-4 py-2 bg-slate-50 border-b border-slate-200">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Unmatched Answers ({unmatchedAnswers.length})
              </p>
            </div>
            {unmatchedAnswers.map((answer) => (
              <UnmatchedCard
                key={answer.id}
                answer={answer}
                isSelected={selectedId === answer.id}
                onClick={() => onSelect({ ...answer, answerStatus: 'unmatched', questionDisplayLabel: '?' })}
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
}
