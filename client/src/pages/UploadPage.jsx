import React, { useCallback, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { ArrowRight, FileText, Upload, X } from 'lucide-react';
import { analyzeDocuments, getDemoAssessment } from '../services/api';

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ACCEPTED_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'image/webp'];

const formatSize = (bytes) => {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))}KB`;
  const mb = bytes / (1024 * 1024);
  return `${mb < 10 ? mb.toFixed(1).replace(/\.0$/, '') : Math.round(mb)}MB`;
};

/**
 * Best-effort page count so the file chip can read "2 Pages" like the design.
 * Returns null when it cannot be determined.
 */
const readPageCount = async (file) => {
  if (file.type !== 'application/pdf') return 1;
  try {
    const text = new TextDecoder('latin1').decode(await file.arrayBuffer());
    const matches = text.match(/\/Type\s*\/Page[^s]/g);
    return matches ? matches.length : null;
  } catch {
    return null;
  }
};

function TeacherIllustration() {
  const dotPositions = [
    'top-0 left-1/2 -translate-x-1/2',
    'top-1/2 right-0 -translate-y-1/2',
    'bottom-0 left-1/2 -translate-x-1/2',
    'top-1/2 left-0 -translate-y-1/2',
  ];

  return (
    <div className="relative w-[108px] h-[108px] mx-auto">
      <span className="absolute inset-0 rounded-full bg-primary-100 animate-ring-pulse" />
      <span className="absolute inset-[10px] rounded-full border-2 border-primary-200" />
      <svg viewBox="0 0 96 96" className="absolute inset-[17px] w-[74px] h-[74px]" aria-hidden="true">
        <defs>
          <clipPath id="teacher-clip">
            <circle cx="48" cy="48" r="48" />
          </clipPath>
        </defs>
        <g clipPath="url(#teacher-clip)">
          <circle cx="48" cy="48" r="48" fill="#ffe4d9" />
          {/* head and hair */}
          <path d="M30 38a18 18 0 0136 0v6a18 18 0 01-36 0z" fill="#f3c6a8" />
          <path d="M28 40c0-13 9-21 20-21s20 8 20 21c-4-5-10-7-20-7s-16 2-20 7z" fill="#2b2b2b" />
          <path d="M28 40c-1 13 2 21 4 23-5-4-7-15-4-23zM68 40c1 13-2 21-4 23 5-4 7-15 4-23z" fill="#2b2b2b" />
          {/* shoulders */}
          <path d="M10 96c3-17 16-26 38-26s35 9 38 26z" fill="#1c1c1c" />
          {/* open book */}
          <path d="M26 82h44v18H26z" fill="#ffffff" />
          <path d="M48 82v18M32 88h12M52 88h12M32 94h12M52 94h12" stroke="#c9d3de" strokeWidth="1.5" />
        </g>
      </svg>
      {dotPositions.map((position) => (
        <span key={position} className={`absolute w-2.5 h-2.5 rounded-full bg-primary-500 ${position}`} />
      ))}
    </div>
  );
}

function UploadCard({ accentLabel, file, onSelect, onClear, disabled }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = (event) => {
    event.preventDefault();
    setDragging(false);
    if (disabled) return;
    const dropped = event.dataTransfer.files?.[0];
    if (dropped) onSelect(dropped);
  };

  return (
    <div
      className={`rounded-3xl border-2 border-dashed bg-white p-4 transition-colors ${
        dragging ? 'border-primary-400 bg-primary-50' : 'border-black/10'
      }`}
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
    >
      <input
        ref={inputRef}
        type="file"
        className="sr-only"
        accept=".pdf,.png,.jpg,.jpeg,.webp"
        disabled={disabled}
        onChange={(event) => {
          const selected = event.target.files?.[0];
          if (selected) onSelect(selected);
          event.target.value = '';
        }}
      />

      {file ? (
        <div className="relative flex items-center gap-3 rounded-2xl bg-black/[0.03] px-3 py-3 mt-2">
          <span className="w-9 h-9 shrink-0 rounded-lg bg-danger-100 flex items-center justify-center">
            <FileText className="w-4 h-4 text-danger-600" />
          </span>
          <div className="min-w-0 text-left">
            <p className="text-sm font-semibold truncate">{file.name}</p>
            <p className="text-xs text-ink-muted">
              {formatSize(file.size)}
              {file.pageCount ? ` • ${file.pageCount} Page${file.pageCount > 1 ? 's' : ''}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClear}
            disabled={disabled}
            aria-label={`Remove ${accentLabel}`}
            className="absolute -top-3 -right-3 w-7 h-7 rounded-full bg-ink-soft text-white flex items-center justify-center transition-colors hover:bg-ink disabled:opacity-50"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
          className="w-full flex flex-col items-center gap-3 py-7 rounded-2xl transition-colors hover:bg-black/[0.02] disabled:cursor-not-allowed"
        >
          <span className="w-10 h-10 rounded-xl bg-black/[0.04] flex items-center justify-center">
            <Upload className="w-[18px] h-[18px] text-ink-soft" />
          </span>
          <span className="text-sm font-semibold">
            Upload <span className="text-primary-500">{accentLabel}</span>
          </span>
          <span className="-mt-2 text-xs text-ink-muted">Max 10MB</span>
        </button>
      )}
    </div>
  );
}

export default function UploadPage({ onAnalysisStarted, onDemoLoaded }) {
  const [questionPaper, setQuestionPaper] = useState(null);
  const [answerSheet, setAnswerSheet] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const selectFile = useCallback(async (file, setter) => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast.error('Please upload a PDF, PNG, JPG or WEBP file.');
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error(`${file.name} is larger than 10MB.`);
      return;
    }
    file.pageCount = await readPageCount(file);
    setter(file);
  }, []);

  const handleStartMapping = async () => {
    if (!questionPaper || !answerSheet || submitting) return;

    setSubmitting(true);
    setUploadProgress(0);
    try {
      const { assessmentId } = await analyzeDocuments(questionPaper, answerSheet, setUploadProgress);
      onAnalysisStarted(assessmentId);
    } catch (err) {
      toast.error(err.message || 'Upload failed. Please try again.');
      setSubmitting(false);
    }
  };

  const handleDemo = async () => {
    setSubmitting(true);
    try {
      onDemoLoaded(await getDemoAssessment());
    } catch (err) {
      toast.error(err.message || 'Could not load the sample assessment.');
      setSubmitting(false);
    }
  };

  const ready = Boolean(questionPaper && answerSheet);

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto px-4 py-6 sm:py-10 text-center animate-fade-up">
        <h1 className="font-display text-2xl sm:text-4xl font-bold leading-tight">
          Upload <span className="marker-accent">Question Paper &amp; Answer Sheets</span>
        </h1>
        <p className="mt-4 text-sm text-ink-muted">Upload both files to get started</p>

        <div className="mt-8">
          <TeacherIllustration />
        </div>

        <div className="mt-8 rounded-[28px] bg-black/[0.025] p-3 sm:p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <UploadCard
              accentLabel="Question Paper"
              file={questionPaper}
              disabled={submitting}
              onSelect={(file) => selectFile(file, setQuestionPaper)}
              onClear={() => setQuestionPaper(null)}
            />
            <UploadCard
              accentLabel="Answer Sheet"
              file={answerSheet}
              disabled={submitting}
              onSelect={(file) => selectFile(file, setAnswerSheet)}
              onClear={() => setAnswerSheet(null)}
            />
          </div>
        </div>

        <div className="mt-8 flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={handleStartMapping}
            disabled={!ready || submitting}
            className="btn-primary"
          >
            {!submitting && 'Start Mapping'}
            {submitting && uploadProgress < 100 && `Uploading ${uploadProgress}%`}
            {submitting && uploadProgress >= 100 && 'Starting…'}
            {!submitting && <ArrowRight className="w-4 h-4" />}
          </button>

          <p className="text-xs text-ink-muted">
            Once both files are uploaded, you&apos;ll be able to map answers with questions
          </p>

          <button
            type="button"
            onClick={handleDemo}
            disabled={submitting}
            className="text-xs font-medium text-ink-muted underline underline-offset-4 transition-colors hover:text-primary-500 disabled:opacity-50"
          >
            Or explore a sample assessment
          </button>
        </div>
      </div>
    </div>
  );
}
