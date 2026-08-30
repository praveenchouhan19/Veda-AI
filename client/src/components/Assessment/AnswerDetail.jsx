import React from 'react';
import { CheckCircle, XCircle, AlertCircle, HelpCircle, MapPin } from 'lucide-react';

const STATUS_CONFIG = {
  answered:   { color: 'text-success-600', bg: 'bg-success-50', label: 'Answered',     Icon: CheckCircle  },
  unanswered: { color: 'text-danger-600',  bg: 'bg-danger-50',  label: 'Not Answered', Icon: XCircle      },
  ambiguous:  { color: 'text-warning-600', bg: 'bg-warning-50', label: 'Needs Review', Icon: AlertCircle  },
  unmatched:  { color: 'text-slate-600',   bg: 'bg-slate-50',   label: 'Unmatched',    Icon: HelpCircle   },
};

function InfoRow({ label, value, valueClass = '' }) {
  if (!value) return null;
  return (
    <div className="py-2 border-b border-slate-100 last:border-0">
      <p className="text-xs text-slate-400 mb-0.5">{label}</p>
      <p className={`text-sm text-slate-800 ${valueClass}`}>{value}</p>
    </div>
  );
}

export default function AnswerDetail({ mapping }) {
  if (!mapping) {
    return (
      <div className="p-4 flex items-center justify-center h-full text-slate-400">
        <p className="text-sm text-center">Select a question to see details</p>
      </div>
    );
  }

  const status = mapping.answerStatus || 'unmatched';
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.unmatched;
  const { Icon } = config;

  const pages = [...new Set((mapping.answerRegions || []).map((r) => r.pageNumber))].sort((a, b) => a - b);

  return (
    <div className="flex flex-col h-full">
      {/* Question header */}
      <div className="px-4 py-4 border-b border-slate-200">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-lg font-bold text-slate-900">
            {mapping.questionDisplayLabel || '?'}
          </span>
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.color}`}>
            <Icon className="w-3 h-3" />
            {config.label}
          </span>
        </div>

        {mapping.questionText && (
          <p className="text-sm text-slate-600 leading-relaxed">
            {mapping.questionText}
          </p>
        )}
      </div>

      {/* Answer details */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        <div className="mb-4">
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
            Answer Details
          </h4>

          <div className="space-y-0">
            <InfoRow
              label="Question Number"
              value={mapping.questionDisplayLabel}
              valueClass="font-medium"
            />
            <InfoRow
              label="Status"
              value={config.label}
              valueClass={config.color}
            />
            {mapping.confidence > 0 && (
              <div className="py-2 border-b border-slate-100">
                <p className="text-xs text-slate-400 mb-1">Confidence</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-slate-100 rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full ${
                        mapping.confidence >= 0.8 ? 'bg-success-500' :
                        mapping.confidence >= 0.6 ? 'bg-warning-500' : 'bg-danger-500'
                      }`}
                      style={{ width: `${mapping.confidence * 100}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium text-slate-700">
                    {Math.round(mapping.confidence * 100)}%
                  </span>
                </div>
              </div>
            )}
            {pages.length > 0 && (
              <div className="py-2 border-b border-slate-100">
                <p className="text-xs text-slate-400 mb-1">
                  <MapPin className="w-3 h-3 inline mr-1" />
                  Answer Location
                </p>
                <div className="flex flex-wrap gap-1">
                  {pages.map((p) => (
                    <span key={p} className="px-2 py-0.5 bg-primary-50 text-primary-700 rounded text-xs font-medium">
                      Page {p}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {mapping.notes && (
              <InfoRow label="Notes" value={mapping.notes} valueClass="text-warning-700" />
            )}
          </div>
        </div>

        {/* Answer text */}
        {mapping.answerText && (
          <div className="mb-4">
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Extracted Answer Text
            </h4>
            <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                {mapping.answerText}
              </p>
            </div>
          </div>
        )}

        {/* AI Grading (if available) */}
        {mapping.grading && (
          <div className="mb-4">
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              AI Grading
            </h4>
            <div className="card p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-slate-800">
                  {mapping.grading.marksAwarded} marks
                </span>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  mapping.grading.status === 'correct' ? 'bg-success-50 text-success-700' :
                  mapping.grading.status === 'partial' ? 'bg-warning-50 text-warning-700' :
                  'bg-danger-50 text-danger-700'
                }`}>
                  {mapping.grading.status === 'correct' ? 'Correct' :
                   mapping.grading.status === 'partial' ? 'Partial' : 'Incorrect'}
                </span>
              </div>
              {mapping.grading.feedback && (
                <p className="text-xs text-slate-600 leading-relaxed">
                  {mapping.grading.feedback}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Unanswered message */}
        {status === 'unanswered' && (
          <div className="bg-danger-50 border border-danger-100 rounded-lg p-3">
            <p className="text-xs text-danger-700 leading-relaxed">
              No answer was detected for this question in the student's answer sheet. 
              The student may have skipped this question.
            </p>
          </div>
        )}

        {/* Unmatched answer info */}
        {status === 'unmatched' && mapping.reason && (
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
            <p className="text-xs text-slate-500 mb-1 font-medium">Why unmatched?</p>
            <p className="text-xs text-slate-600">{mapping.reason}</p>
          </div>
        )}
      </div>
    </div>
  );
}
