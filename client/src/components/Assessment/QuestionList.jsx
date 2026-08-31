import React from 'react';
import { AlertCircle, ChevronDown, FileQuestion } from 'lucide-react';

const scorePillClass = (mapping) => {
  const grading = mapping.grading;
  if (!grading || !grading.maxMarks) return 'score-pill-none';
  const ratio = grading.marksAwarded / grading.maxMarks;
  if (ratio >= 1) return 'score-pill-good';
  if (ratio > 0) return 'score-pill-partial';
  return 'score-pill-bad';
};

const statusCopy = {
  answered: { label: 'Mapped', className: 'text-success-600' },
  ambiguous: { label: 'Needs review', className: 'text-warning-600' },
  unanswered: { label: 'Not answered', className: 'text-danger-600' },
};

function ScorePill({ mapping }) {
  const grading = mapping.grading;
  if (!grading || grading.maxMarks == null) {
    return <span className="score-pill score-pill-none">—</span>;
  }
  return (
    <span className={`score-pill ${scorePillClass(mapping)}`}>
      {grading.marksAwarded}/{grading.maxMarks}
    </span>
  );
}

function QuestionRow({ mapping, index, expanded, selected, onSelect, onToggle }) {
  const status = statusCopy[mapping.answerStatus] || statusCopy.unanswered;

  return (
    <li
      className={`rounded-2xl border transition-colors ${
        selected ? 'border-primary-400 bg-primary-50/60' : 'border-black/[0.07] bg-white hover:border-black/15'
      }`}
    >
      <div className="flex items-start gap-3 p-3">
        <button
          type="button"
          onClick={onSelect}
          className={`shrink-0 w-6 h-6 mt-0.5 rounded-full text-[11px] font-semibold flex items-center justify-center transition-colors ${
            selected ? 'bg-primary-500 text-white' : 'bg-black/[0.06] text-ink-soft'
          }`}
          aria-label={`Show answer for question ${mapping.questionNumber}`}
        >
          {index + 1}
        </button>

        <button type="button" onClick={onSelect} className="flex-1 min-w-0 text-left">
          <p className="text-[13px] leading-snug text-ink-soft line-clamp-3">{mapping.questionText}</p>
          <p className={`mt-1 text-[11px] font-medium ${status.className}`}>{status.label}</p>
        </button>

        <div className="shrink-0 flex items-center gap-1.5">
          <ScorePill mapping={mapping} />
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={expanded}
            aria-label={expanded ? 'Hide feedback' : 'Show feedback'}
            className="icon-btn w-6 h-6"
          >
            <ChevronDown
              className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`}
            />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="px-3 pb-3 pl-12 space-y-3 animate-fade-up">
          {mapping.grading?.feedback && (
            <div>
              <p className="text-xs font-semibold">AI Feedback</p>
              <p className="mt-1 text-xs leading-relaxed text-ink-muted">{mapping.grading.feedback}</p>
            </div>
          )}

          {mapping.answerText ? (
            <div>
              <p className="text-xs font-semibold">Extracted Answer</p>
              <p className="mt-1 text-xs leading-relaxed text-ink-muted whitespace-pre-wrap">
                {mapping.answerText}
              </p>
            </div>
          ) : (
            !mapping.grading?.feedback && (
              <p className="text-xs text-danger-600">
                No answer for this question was found on the answer sheet.
              </p>
            )
          )}

          {mapping.notes && (
            <p className="flex items-start gap-1.5 text-xs text-warning-600">
              <AlertCircle className="w-3.5 h-3.5 mt-px shrink-0" />
              <span>{mapping.notes}</span>
            </p>
          )}
        </div>
      )}
    </li>
  );
}

export default function QuestionList({
  mappings,
  unmatchedAnswers = [],
  selectedId,
  expandedIds,
  onSelect,
  onToggleExpand,
  onToggleExpandAll,
  allExpanded,
}) {
  return (
    <section className="h-full min-h-0 flex flex-col bg-white rounded-3xl shadow-card overflow-hidden">
      <header className="shrink-0 flex items-center justify-between gap-3 px-4 py-3 border-b border-black/5">
        <h2 className="text-sm font-semibold">
          Extracted Questions <span className="font-normal text-ink-muted">(from question paper)</span>
        </h2>
        <button
          type="button"
          onClick={onToggleExpandAll}
          className="shrink-0 text-xs font-medium text-ink-muted transition-colors hover:text-primary-500"
        >
          {allExpanded ? 'Collapse All' : 'Expand All'}
        </button>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto p-3">
        {mappings.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-3 text-center text-ink-muted">
            <FileQuestion className="w-8 h-8" />
            <p className="text-sm max-w-xs">No questions could be read from the question paper.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {mappings.map((mapping, index) => (
              <QuestionRow
                key={mapping.id}
                mapping={mapping}
                index={index}
                selected={mapping.id === selectedId}
                expanded={expandedIds.has(mapping.id)}
                onSelect={() => onSelect(mapping)}
                onToggle={() => onToggleExpand(mapping.id)}
              />
            ))}
          </ul>
        )}

        {unmatchedAnswers.length > 0 && (
          <div className="mt-5">
            <p className="px-1 text-xs font-semibold text-ink-muted">
              Unmatched answers ({unmatchedAnswers.length})
            </p>
            <ul className="mt-2 space-y-2">
              {unmatchedAnswers.map((answer) => (
                <li key={answer.id} className="rounded-2xl border border-warning-500/30 bg-warning-50 p-3">
                  <p className="text-xs font-semibold text-warning-600">
                    {answer.questionNumber ? `Labelled "${answer.questionNumber}"` : 'No question number'}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-ink-muted line-clamp-3">{answer.text}</p>
                  <p className="mt-1.5 text-[11px] text-ink-faint">{answer.reason}</p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
