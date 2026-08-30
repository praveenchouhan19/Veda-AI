import React, { useState } from 'react';
import { Toaster } from 'react-hot-toast';
import UploadPage from './pages/UploadPage';
import AssessmentPage from './pages/AssessmentPage';
import ProcessingPage from './pages/ProcessingPage';

// App state machine: upload → processing → assessment
const VIEWS = {
  UPLOAD: 'upload',
  PROCESSING: 'processing',
  ASSESSMENT: 'assessment',
};

function App() {
  const [view, setView] = useState(VIEWS.UPLOAD);
  const [assessmentId, setAssessmentId] = useState(null);
  const [assessment, setAssessment] = useState(null);

  const handleAnalysisStarted = (id) => {
    setAssessmentId(id);
    setView(VIEWS.PROCESSING);
  };

  const handleDemoLoaded = (demoAssessment) => {
    setAssessment(demoAssessment);
    setView(VIEWS.ASSESSMENT);
  };

  const handleProcessingComplete = (completedAssessment) => {
    setAssessment(completedAssessment);
    setView(VIEWS.ASSESSMENT);
  };

  const handleReset = () => {
    setView(VIEWS.UPLOAD);
    setAssessmentId(null);
    setAssessment(null);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: { fontSize: '14px' },
        }}
      />

      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-screen-2xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-5 h-5 text-white fill-current">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div>
              <span className="text-lg font-semibold text-slate-900">VedaAI</span>
              <span className="ml-2 text-sm text-slate-500">Assessment Tool</span>
            </div>
          </div>

          {view !== VIEWS.UPLOAD && (
            <button
              onClick={handleReset}
              className="btn-secondary text-xs"
            >
              ← New Assessment
            </button>
          )}
        </div>
      </header>

      {/* Main content */}
      <main>
        {view === VIEWS.UPLOAD && (
          <UploadPage
            onAnalysisStarted={handleAnalysisStarted}
            onDemoLoaded={handleDemoLoaded}
          />
        )}

        {view === VIEWS.PROCESSING && (
          <ProcessingPage
            assessmentId={assessmentId}
            onComplete={handleProcessingComplete}
            onError={() => setView(VIEWS.UPLOAD)}
          />
        )}

        {view === VIEWS.ASSESSMENT && assessment && (
          <AssessmentPage
            assessment={assessment}
            onReset={handleReset}
          />
        )}
      </main>
    </div>
  );
}

export default App;
