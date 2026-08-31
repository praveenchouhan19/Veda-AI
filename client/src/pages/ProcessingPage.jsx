import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { getAssessment } from '../services/api';

const POLL_INTERVAL = 2500;

function Sparkles() {
  return (
    <div className="relative w-24 h-24" aria-hidden="true">
      <svg viewBox="0 0 24 24" className="absolute left-6 top-0 w-12 h-12 text-primary-500 animate-sparkle-pulse">
        <path d="M12 0l2.2 7.8L22 10l-7.8 2.2L12 20l-2.2-7.8L2 10l7.8-2.2L12 0z" fill="currentColor" />
      </svg>
      <svg
        viewBox="0 0 24 24"
        className="absolute left-0 bottom-2 w-8 h-8 text-primary-500 animate-sparkle-pulse [animation-delay:300ms]"
      >
        <path d="M12 0l2.2 7.8L22 10l-7.8 2.2L12 20l-2.2-7.8L2 10l7.8-2.2L12 0z" fill="currentColor" />
      </svg>
      <svg
        viewBox="0 0 24 24"
        className="absolute right-1 bottom-4 w-5 h-5 text-primary-400 animate-sparkle-pulse [animation-delay:600ms]"
      >
        <path d="M12 0l2.2 7.8L22 10l-7.8 2.2L12 20l-2.2-7.8L2 10l7.8-2.2L12 0z" fill="currentColor" />
      </svg>
      <span className="absolute left-4 top-6 w-2 h-2 rounded-full bg-primary-400" />
      <span className="absolute right-6 top-9 w-1.5 h-1.5 rounded-full bg-primary-300" />
    </div>
  );
}

export default function ProcessingPage({ assessmentId, onComplete, onError }) {
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState(null);
  const timerRef = useRef(null);
  const completedRef = useRef(false);

  useEffect(() => {
    if (!assessmentId) return undefined;

    const stop = () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    };

    const poll = async () => {
      try {
        const assessment = await getAssessment(assessmentId);

        if (assessment.status === 'complete' && !completedRef.current) {
          completedRef.current = true;
          stop();
          onComplete(assessment);
        } else if (assessment.status === 'error') {
          stop();
          setError(assessment.error || 'We could not process these documents.');
        } else if (assessment.progress) {
          setProgress(assessment.progress);
        }
      } catch (err) {
        // Transient network errors are expected while the server is busy.
        console.warn('Polling assessment failed:', err.message);
      }
    };

    poll();
    timerRef.current = setInterval(poll, POLL_INTERVAL);
    return stop;
  }, [assessmentId, onComplete]);

  return (
    <div className="h-full bg-white rounded-3xl shadow-card flex items-center justify-center p-6">
      {error ? (
        <div className="max-w-md text-center animate-fade-up">
          <span className="inline-flex w-14 h-14 rounded-full bg-danger-100 items-center justify-center">
            <AlertTriangle className="w-6 h-6 text-danger-600" />
          </span>
          <h2 className="mt-5 font-display text-xl font-semibold">Extraction failed</h2>
          <p className="mt-2 text-sm text-ink-muted leading-relaxed">{error}</p>
          <button type="button" onClick={onError} className="btn-primary mt-6">
            <RotateCcw className="w-4 h-4" />
            Try again
          </button>
        </div>
      ) : (
        <div className="text-center animate-fade-up">
          <div className="flex justify-center">
            <Sparkles />
          </div>
          <h2 className="mt-6 font-display text-2xl font-bold">Extracting…</h2>
          <p className="mt-2 text-sm text-ink-muted">
            {progress?.message || 'Reading your documents'}
          </p>

          {progress?.percent > 0 && (
            <div className="mt-6 w-56 mx-auto h-1 rounded-full bg-black/[0.06] overflow-hidden">
              <div
                className="h-full rounded-full bg-primary-500 transition-[width] duration-500"
                style={{ width: `${Math.min(100, progress.percent)}%` }}
              />
            </div>
          )}

          <p className="mt-5 text-xs text-ink-muted">This usually takes around 5 minutes</p>
        </div>
      )}
    </div>
  );
}
