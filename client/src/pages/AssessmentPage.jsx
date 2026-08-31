import React, { useMemo, useState } from 'react';
import QuestionList from '../components/Assessment/QuestionList';
import AnswerViewer from '../components/Assessment/AnswerViewer';

export default function AssessmentPage({ assessment }) {
  const mappings = useMemo(() => assessment?.mappings || [], [assessment]);
  const [selectedId, setSelectedId] = useState(() => mappings[0]?.id ?? null);
  const [expandedIds, setExpandedIds] = useState(() => new Set());
  const [mobileTab, setMobileTab] = useState('questions');

  const selectedMapping = mappings.find((m) => m.id === selectedId) || null;
  const allExpanded = mappings.length > 0 && expandedIds.size === mappings.length;

  const handleSelect = (mapping) => {
    setSelectedId(mapping.id);
    setMobileTab('answer');
  };

  const handleToggleExpand = (id) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleToggleExpandAll = () => {
    setExpandedIds(allExpanded ? new Set() : new Set(mappings.map((m) => m.id)));
  };

  const questionPanel = (
    <QuestionList
      mappings={mappings}
      unmatchedAnswers={assessment?.unmatchedAnswers || []}
      selectedId={selectedId}
      expandedIds={expandedIds}
      onSelect={handleSelect}
      onToggleExpand={handleToggleExpand}
      onToggleExpandAll={handleToggleExpandAll}
      allExpanded={allExpanded}
    />
  );

  const answerPanel = (
    <AnswerViewer
      assessment={assessment}
      selectedMapping={selectedMapping}
      onSelectMapping={(mapping) => setSelectedId(mapping.id)}
    />
  );

  return (
    <div className="h-full min-h-0 flex flex-col gap-3 animate-fade-up">
      {/* Mobile switches between the two panels; desktop shows them side by side. */}
      <div className="lg:hidden shrink-0 grid grid-cols-2 gap-1 p-1 rounded-full bg-white shadow-card">
        {[
          { id: 'questions', label: 'Questions' },
          { id: 'answer', label: 'Answer Sheet' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setMobileTab(tab.id)}
            className={`py-2 text-sm font-medium rounded-full transition-colors ${
              mobileTab === tab.id ? 'bg-ink text-white' : 'text-ink-muted'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0 flex gap-3">
        <div
          className={`min-h-0 w-full lg:w-[380px] xl:w-[420px] lg:shrink-0 ${
            mobileTab === 'questions' ? 'block' : 'hidden lg:block'
          }`}
        >
          {questionPanel}
        </div>

        <div className={`min-h-0 flex-1 ${mobileTab === 'answer' ? 'block' : 'hidden lg:block'}`}>
          {answerPanel}
        </div>
      </div>
    </div>
  );
}
