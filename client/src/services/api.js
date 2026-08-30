import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const api = axios.create({
  baseURL: `${API_URL}/api`,
  timeout: 120000, // 2 min for AI processing
});

// Request interceptor for logging
api.interceptors.request.use((config) => {
  return config;
});

// Response interceptor for unified error handling
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const message =
      error.response?.data?.error?.message ||
      error.message ||
      'An unexpected error occurred';
    return Promise.reject(new Error(message));
  }
);

/**
 * Analyze documents — submit question paper + answer sheet
 */
export const analyzeDocuments = async (questionPaperFile, answerSheetFile, onProgress) => {
  const formData = new FormData();
  formData.append('questionPaper', questionPaperFile);
  formData.append('answerSheet', answerSheetFile);

  const response = await api.post('/analyze', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (progressEvent) => {
      if (onProgress) {
        const pct = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        onProgress(pct);
      }
    },
  });

  return response;
};

/**
 * Poll for assessment results
 */
export const getAssessment = async (id) => {
  const response = await api.get(`/assessment/${id}`);
  return response.assessment;
};

/**
 * Delete an assessment
 */
export const deleteAssessment = async (id) => {
  return await api.delete(`/assessment/${id}`);
};

/**
 * Load demo data
 */
export const getDemoAssessment = async () => {
  const response = await api.get('/demo');
  return response.assessment;
};

/**
 * Health check
 */
export const checkHealth = async () => {
  return await api.get('/health');
};
