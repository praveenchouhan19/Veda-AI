import React, { useState } from 'react';
import { Toaster } from 'react-hot-toast';
import Sidebar from './components/layout/Sidebar';
import TopBar from './components/layout/TopBar';
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const handleAnalysisStarted = (id) => {
    setAssessmentId(id);
    setSidebarCollapsed(true);
    setView(VIEWS.PROCESSING);
  };

  const handleDemoLoaded = (demoAssessment) => {
    setAssessment(demoAssessment);
    setSidebarCollapsed(true);
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
    setSidebarCollapsed(false);
  };

  return (
    <div className="h-full bg-canvas p-2 sm:p-3 lg:p-4">
      <Toaster
        position="top-right"
        toastOptions={{ duration: 4000, style: { fontSize: '14px', borderRadius: '12px' } }}
      />

      <div className="h-full flex gap-3 lg:gap-4">
        <div className="hidden md:flex">
          <Sidebar
            collapsed={sidebarCollapsed}
            onToggle={() => setSidebarCollapsed((c) => !c)}
            active="exams"
          />
        </div>

        <div className="flex-1 min-w-0 flex flex-col">
          <TopBar
            showBack={view !== VIEWS.UPLOAD}
            onBack={handleReset}
            breadcrumb="Exams"
          />

          <main className="flex-1 min-h-0">
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
                onError={handleReset}
              />
            )}

            {view === VIEWS.ASSESSMENT && assessment && (
              <AssessmentPage assessment={assessment} onReset={handleReset} />
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

export default App;
