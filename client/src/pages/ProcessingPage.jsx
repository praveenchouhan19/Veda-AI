import React, { useEffect, useState, useRef } from 'react';
import { CheckCircle, AlertCircle } from 'lucide-react';
import { getAssessment } from '../services/api';

const STAGES = [
  { id: 'uploading',   label: 'Uploading files',           duration: 1500 },
  { id: 'reading_qp',  label: 'Reading question paper',    duration: 2000 },
  { id: 'extracting',  label: 'Extracting questions',      duration: 3000 },
  { id: 'reading_as',  label: 'Reading answer sheet',      duration: 2000 },
  { id: 'detecting',   label: 'Detecting handwritten answers', duration: 4000 },
  { id: 'mapping',     label: 'Mapping answers to questions', duration: 3000 },
  { id: 'regions',     label: 'Identifying answer regions', duration: 2000 },
  { id: 'generating',  label: 'Generating assessment',     duration: 2000 },
  { id: 'complete',    label: 'Assessment complete!',       duration: 500 },
];

export default function ProcessingPage({ assessmentId, onComplete, onError }) {
  const [currentStage, setCurrentStage] = useState(0);
  const [error, setError] = useState(null);
  const pollRef = useRef(null);
  const stageRef = useRef(null);

  // Animate through stages for visual feedback
  useEffect(() => {
    let stageIndex = 0;
    const advanceStage = () => {
      if (stageIndex < STAGES.length - 1) {
        stageIndex++;
        setCurrentStage(stageIndex);
        stageRef.current = setTimeout(advanceStage, STAGES[stageIndex].duration);
      }
    };
    stageRef.current = setTimeout(advanceStage, STAGES[0].duration);
    return () => clearTimeout(stageRef.current);
  }, []);

  // Poll backend for completion
  useEffect(() => {
    if (!assessmentId) return;

    const poll = async () => {
      try {
        const assessment = await getAssessment(assessmentId);

        if (assessment.status === 'complete') {
          clearInterval(pollRef.current);
          setCurrentStage(STAGES.length - 1);
          setTimeout(() => onComplete(assessment), 800);
        } else if (assessment.status === 'error') {
          clearInterval(pollRef.current);
          setError(assessment.error || 'Processing failed. Please try again.');
        }
        // status === 'processing' → keep polling
      } catch (err) {
        // Network error — keep trying
        console.error('Poll error:', err.message);
      }
    };

    // Poll every 3 seconds
    pollRef.current = setInterval(poll, 3000);
    poll(); // immediate first check

    return () => clearInterval(pollRef.current);
  }, [assessmentId, onComplete]);

  if (error) {
    return (
      <div className="max-w-lg mx-auto px-6 py-20 text-center">
        <div className="w-16 h-16 bg-danger-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-8 h-8 text-danger-500" />
        </div>
        <h2 className="text-xl font-semibold text-slate-900 mb-2">Processing Failed</h2>
        <p className="text-sm text-slate-500 mb-6">{error}</p>
        <button onClick={onError} className="btn-primary">
          Try Again
        </button>
      </div>
    );
  }

  const progress = Math.round(((currentStage + 1) / STAGES.length) * 100);

  return (
    <div className="max-w-lg mx-auto px-6 py-16">
      <div className="text-center mb-8">
        <div className="w-16 h-16 mx-auto mb-4 relative">
          <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
            <circle cx="32" cy="32" r="28" fill="none" stroke="#e2e8f0" strokeWidth="6" />
            <circle
              cx="32" cy="32" r="28"
              fill="none"
              stroke="#6366f1"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 28}`}
              strokeDashoffset={`${2 * Math.PI * 28 * (1 - progress / 100)}`}
              className="transition-all duration-700"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-sm font-bold text-primary-600">{progress}%</span>
          </div>
        </div>
        <h2 className="text-xl font-semibold text-slate-900 mb-1">Analyzing Documents</h2>
        <p className="text-sm text-slate-500">This may take 30–60 seconds for AI processing</p>
      </div>

      <div className="card p-4 space-y-1">
        {STAGES.map((stage, index) => {
          const isDone = index < currentStage;
          const isActive = index === currentStage;
          return (
            <div
              key={stage.id}
              className={`flex items-center gap-3 py-2 px-3 rounded-lg transition-all duration-300
                ${isActive ? 'bg-primary-50' : 'bg-transparent'}`}
            >
              <div className="w-5 h-5 flex-shrink-0">
                {isDone ? (
                  <CheckCircle className="w-5 h-5 text-success-500" />
                ) : isActive ? (
                  <svg className="animate-spin w-5 h-5 text-primary-500" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <div className="w-5 h-5 rounded-full border-2 border-slate-200" />
                )}
              </div>
              <span className={`text-sm ${isActive ? 'text-primary-700 font-medium' : isDone ? 'text-slate-500' : 'text-slate-300'}`}>
                {stage.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
