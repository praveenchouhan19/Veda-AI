import React, { useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { Upload, FileText, Image, X, CheckCircle, Play, Sparkles } from 'lucide-react';
import { analyzeDocuments, getDemoAssessment } from '../services/api';

const ACCEPTED_TYPES = {
  'application/pdf': '.pdf',
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/webp': '.webp',
};
const MAX_SIZE_MB = 20;

const formatBytes = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const getFileIcon = (file) => {
  if (file.type === 'application/pdf') return <FileText className="w-5 h-5 text-red-500" />;
  return <Image className="w-5 h-5 text-blue-500" />;
};

const DropZone = ({ label, description, file, onFile, onRemove, accept }) => {
  const [dragging, setDragging] = useState(false);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) onFile(dropped);
  }, [onFile]);

  const handleDragOver = (e) => { e.preventDefault(); setDragging(true); };
  const handleDragLeave = () => setDragging(false);

  const handleInputChange = (e) => {
    const selected = e.target.files[0];
    if (selected) onFile(selected);
  };

  if (file) {
    return (
      <div className="border-2 border-success-500 bg-success-50 rounded-xl p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white rounded-lg shadow-sm flex items-center justify-center">
              {getFileIcon(file)}
            </div>
            <div>
              <p className="text-sm font-medium text-slate-800 truncate max-w-xs">{file.name}</p>
              <p className="text-xs text-slate-500 mt-0.5">
                {file.type === 'application/pdf' ? 'PDF Document' : 'Image'} · {formatBytes(file.size)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-success-500" />
            <button
              onClick={onRemove}
              className="p-1.5 rounded-lg hover:bg-danger-50 text-slate-400 hover:text-danger-500 transition-colors"
              title="Remove file"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <label
      className={`block border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200
        ${dragging
          ? 'border-primary-500 bg-primary-50'
          : 'border-slate-200 hover:border-primary-300 hover:bg-slate-50'
        }`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      <input
        type="file"
        className="hidden"
        accept={Object.keys(ACCEPTED_TYPES).join(',')}
        onChange={handleInputChange}
      />
      <Upload className={`w-8 h-8 mx-auto mb-3 ${dragging ? 'text-primary-500' : 'text-slate-300'}`} />
      <p className="text-sm font-medium text-slate-700 mb-1">{label}</p>
      <p className="text-xs text-slate-400">{description}</p>
      <p className="text-xs text-slate-400 mt-2">PDF, PNG, JPG · Max {MAX_SIZE_MB}MB</p>
    </label>
  );
};

export default function UploadPage({ onAnalysisStarted, onDemoLoaded }) {
  const [questionPaper, setQuestionPaper] = useState(null);
  const [answerSheet, setAnswerSheet] = useState(null);
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const validateFile = (file) => {
    if (!ACCEPTED_TYPES[file.type]) {
      toast.error(`Invalid file type: ${file.type}. Use PDF, PNG, or JPG.`);
      return false;
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      toast.error(`File too large. Maximum size is ${MAX_SIZE_MB}MB.`);
      return false;
    }
    return true;
  };

  const handleQuestionPaper = (file) => {
    if (validateFile(file)) setQuestionPaper(file);
  };

  const handleAnswerSheet = (file) => {
    if (validateFile(file)) setAnswerSheet(file);
  };

  const handleAnalyze = async () => {
    if (!questionPaper || !answerSheet) {
      toast.error('Please upload both files before analyzing.');
      return;
    }

    setLoading(true);
    setUploadProgress(0);

    try {
      const response = await analyzeDocuments(questionPaper, answerSheet, setUploadProgress);
      onAnalysisStarted(response.assessmentId);
    } catch (err) {
      toast.error(err.message || 'Failed to start analysis. Please try again.');
      setLoading(false);
    }
  };

  const handleDemo = async () => {
    setDemoLoading(true);
    try {
      const demo = await getDemoAssessment();
      toast.success('Demo assessment loaded!');
      onDemoLoaded(demo);
    } catch (err) {
      toast.error('Failed to load demo data. Is the server running?');
    } finally {
      setDemoLoading(false);
    }
  };

  const canAnalyze = questionPaper && answerSheet && !loading;

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      {/* Hero section */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary-50 text-primary-600 rounded-full text-xs font-medium mb-4">
          <Sparkles className="w-3.5 h-3.5" />
          AI-Powered Assessment
        </div>
        <h1 className="text-3xl font-bold text-slate-900 mb-3">
          Analyze Answer Sheets Instantly
        </h1>
        <p className="text-slate-500 max-w-lg mx-auto text-sm leading-relaxed">
          Upload a question paper and a student's handwritten answer sheet.
          Our AI extracts questions, maps answers, highlights regions, and flags unanswered questions.
        </p>
      </div>

      {/* Upload card */}
      <div className="card p-6 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Question Paper
            </label>
            <DropZone
              label="Drop question paper here"
              description="PDF or image of the printed question paper"
              file={questionPaper}
              onFile={handleQuestionPaper}
              onRemove={() => setQuestionPaper(null)}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Student Answer Sheet
            </label>
            <DropZone
              label="Drop answer sheet here"
              description="PDF or image of handwritten answers"
              file={answerSheet}
              onFile={handleAnswerSheet}
              onRemove={() => setAnswerSheet(null)}
            />
          </div>
        </div>

        {/* Upload progress bar */}
        {loading && uploadProgress > 0 && uploadProgress < 100 && (
          <div className="mb-4">
            <div className="flex justify-between text-xs text-slate-500 mb-1">
              <span>Uploading files...</span>
              <span>{uploadProgress}%</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-1.5">
              <div
                className="bg-primary-500 h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-center gap-3">
          <button
            onClick={handleAnalyze}
            disabled={!canAnalyze}
            className="btn-primary w-full sm:w-auto flex-1 py-2.5"
          >
            {loading ? (
              <>
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Processing...
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Analyze Documents
              </>
            )}
          </button>

          <div className="text-slate-400 text-sm hidden sm:block">or</div>

          <button
            onClick={handleDemo}
            disabled={demoLoading}
            className="btn-secondary w-full sm:w-auto"
          >
            {demoLoading ? (
              <>
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Loading...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Try Demo
              </>
            )}
          </button>
        </div>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-3 gap-3 text-center">
        {[
          { icon: '📄', title: 'Question Extraction', desc: 'AI reads every question including sub-parts' },
          { icon: '✍️', title: 'Handwriting Detection', desc: 'Gemini Vision identifies handwritten answers' },
          { icon: '🎯', title: 'Smart Mapping', desc: 'Handles out-of-order and multi-page answers' },
        ].map((item) => (
          <div key={item.title} className="card p-4">
            <div className="text-2xl mb-2">{item.icon}</div>
            <p className="text-xs font-semibold text-slate-700 mb-1">{item.title}</p>
            <p className="text-xs text-slate-400">{item.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
