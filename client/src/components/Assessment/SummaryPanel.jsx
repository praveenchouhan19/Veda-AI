import React from 'react';
import { CheckCircle, XCircle, AlertCircle, HelpCircle, FileText } from 'lucide-react';

function StatCard({ value, label, color, icon: Icon }) {
  return (
    <div className="card p-5 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-900">{value}</p>
        <p className="text-sm text-slate-500">{label}</p>
      </div>
    </div>
  );
}

export default function SummaryPanel({ summary, mappings, unmatchedAnswers, assessment }) {
  const { totalQuestions = 0, answered = 0, unanswered = 0, ambiguous = 0, unmatchedAnswers: unmatchedCount = 0 } = summary;

  const answeredPct = totalQuestions > 0 ? Math.round((answered / totalQuestions) * 100) : 0;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-900 mb-1">Assessment Summary</h2>
        <div className="flex items-center gap-2">
          <p className="text-sm text-slate-500">
            {assessment.questionPaper?.originalName} ↔ {assessment.answerSheet?.originalName}
          </p>
          {assessment.isDemo && (
            <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-xs font-medium">Demo</span>
          )}
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard value={totalQuestions} label="Total Questions" color="bg-primary-50 text-primary-600" icon={FileText} />
        <StatCard value={answered}       label="Answered"        color="bg-success-50 text-success-600" icon={CheckCircle} />
        <StatCard value={unanswered}     label="Not Answered"    color="bg-danger-50 text-danger-500"   icon={XCircle} />
        <StatCard value={ambiguous}      label="Needs Review"    color="bg-warning-50 text-warning-600" icon={AlertCircle} />
      </div>

      {/* Progress bar */}
      <div className="card p-5 mb-6">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-semibold text-slate-700">Overall Completion</span>
          <span className="text-2xl font-bold text-primary-600">{answeredPct}%</span>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-3">
          <div
            className="bg-primary-500 h-3 rounded-full transition-all duration-500"
            style={{ width: `${answeredPct}%` }}
          />
        </div>
        <p className="text-xs text-slate-400 mt-2">
          {answered} of {totalQuestions} questions answered
          {unanswered > 0 && ` · ${unanswered} unanswered`}
          {ambiguous > 0 && ` · ${ambiguous} need review`}
        </p>
      </div>

      {/* Question breakdown table */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
          <h3 className="text-sm font-semibold text-slate-700">Question Breakdown</h3>
        </div>
        <div className="divide-y divide-slate-50">
          {mappings.map((m) => (
            <div key={m.id} className="px-5 py-3 flex items-center gap-4">
              <span className="text-sm font-bold text-slate-700 w-16 flex-shrink-0">
                {m.questionDisplayLabel}
              </span>
              <p className="text-xs text-slate-500 flex-1 truncate">{m.questionText}</p>
              <div className="flex items-center gap-2 flex-shrink-0">
                {m.confidence > 0 && (
                  <span className="text-xs text-slate-400">{Math.round(m.confidence * 100)}%</span>
                )}
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                  m.answerStatus === 'answered'   ? 'badge-answered'   :
                  m.answerStatus === 'unanswered' ? 'badge-unanswered' :
                  m.answerStatus === 'ambiguous'  ? 'badge-ambiguous'  : 'badge-unmatched'
                }`}>
                  {m.answerStatus === 'answered'   && <CheckCircle className="w-3 h-3" />}
                  {m.answerStatus === 'unanswered' && <XCircle className="w-3 h-3" />}
                  {m.answerStatus === 'ambiguous'  && <AlertCircle className="w-3 h-3" />}
                  {m.answerStatus === 'answered'   ? 'Answered'
                    : m.answerStatus === 'unanswered' ? 'Not Answered'
                    : m.answerStatus === 'ambiguous'  ? 'Review'
                    : 'Unmatched'}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Unmatched answers */}
        {unmatchedAnswers && unmatchedAnswers.length > 0 && (
          <>
            <div className="px-5 py-2 bg-slate-50 border-t border-slate-100">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Unmatched Answers ({unmatchedAnswers.length})
              </p>
            </div>
            {unmatchedAnswers.map((u) => (
              <div key={u.id} className="px-5 py-3 flex items-center gap-4">
                <span className="text-sm font-bold text-slate-400 w-16 flex-shrink-0">?</span>
                <p className="text-xs text-slate-500 flex-1 truncate">{u.text || 'Unreadable/unattributed'}</p>
                <div className="flex-shrink-0">
                  <span className="badge-unmatched">
                    <HelpCircle className="w-3 h-3" />
                    Review
                  </span>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
