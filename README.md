# VedaAI Assessment Tool

An AI-powered full-stack web application for teachers to upload question papers and student handwritten answer sheets, automatically extract and map answers to questions, and visually highlight exact answer regions.

## Features

- **Question Extraction** — Reads printed question papers (PDF/image), extracts every question preserving original numbering and sub-parts (e.g. Q11(a), Q11(b) as separate items)
- **Handwritten Answer Detection** — Uses Google Gemini Vision to identify handwritten answers, detect question numbers written by students, and extract answer text
- **Out-of-Order Mapping** — Correctly maps answers even when students answer questions out of order
- **Multi-Page Answers** — Tracks answers that span multiple pages, associating all regions with the same question
- **Exact Region Highlighting** — Highlights precise bounding boxes on the answer sheet image using normalized (0–1) coordinates
- **Unanswered Detection** — Clearly identifies and displays skipped questions
- **Unmatched Answers** — Flags answer content that cannot be attributed to any question
- **Demo Mode** — Full demo assessment with realistic edge cases (no API key needed)
- **AI Grading (optional)** — Gemini-powered marks + feedback per question

## Architecture

```
vedaai/
├── client/          React + Vite + Tailwind CSS (frontend)
└── server/          Node.js + Express (backend API + AI pipeline)
```

### AI Pipeline

```
PDF/Image Upload
    │
    ▼
PDF → Images (pdf2pic, one image per page)
    │
    ▼
Gemini Vision Analysis
    │
    ├── Question Paper  →  { questions: [{ number, text, boundingBox, pageNumber }] }
    │
    └── Answer Sheet    →  { answers: [{ questionNumber, text, regions, confidence }] }
    │
    ▼
Hybrid Mapping Algorithm
    ├── 1. Normalize question numbers (Q1 → 1, "11 (a)" → 11a)
    ├── 2. Exact string match
    ├── 3. Partial match (subpart fallback)
    └── 4. Confidence assignment (< 0.7 → "Review")
    │
    ▼
Assessment Result
    { mappings, unmatchedAnswers, summary }
    │
    ▼
Frontend Viewer
    └── Highlight overlay using normalized (0-1) bounding boxes
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite 5, Tailwind CSS 3, lucide-react |
| Backend | Node.js, Express.js |
| AI | Google Gemini 1.5 Flash |
| Database | MongoDB (optional — falls back to in-memory) |
| File Processing | pdf2pic, sharp |
| HTTP Client | Axios |

## Setup

### Prerequisites
- Node.js 18+
- MongoDB (optional — app works without it)
- Google Gemini API key (free tier works)

### 1. Clone and install

```bash
git clone <repo>
cd vedaai
```

### 2. Backend setup

```bash
cd server
npm install
cp .env.example .env
# Edit .env and set your GEMINI_API_KEY
```

### 3. Frontend setup

```bash
cd client
npm install
cp .env.example .env
# Verify VITE_API_URL=http://localhost:5000
```

## Running Locally

**Terminal 1 — Backend:**
```bash
cd server
npm run dev
# Server starts on http://localhost:5000
```

**Terminal 2 — Frontend:**
```bash
cd client
npm run dev
# App opens at http://localhost:5173
```

## Environment Variables

### server/.env
```
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/vedaai
GEMINI_API_KEY=your_key_here
CLIENT_URL=http://localhost:5173
MAX_FILE_SIZE=20971520
```

### client/.env
```
VITE_API_URL=http://localhost:5000
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/analyze` | Upload files + start AI pipeline |
| GET | `/api/assessment/:id` | Poll for assessment results |
| DELETE | `/api/assessment/:id` | Delete assessment |
| GET | `/api/demo` | Load demo assessment data |
| GET | `/api/health` | Health check |

## Deployment

### Frontend → Vercel
```bash
cd client
npm run build
# Deploy dist/ to Vercel
# Set VITE_API_URL to your backend URL
```

### Backend → Render / Railway
```bash
cd server
# Set all env vars in Render/Railway dashboard
# Start command: npm start
```

### Database → MongoDB Atlas
- Create free cluster at mongodb.com
- Replace MONGODB_URI with Atlas connection string

## How Highlighting Works

Bounding boxes are stored as normalized coordinates (0.0–1.0):
```
{ x: 0.05, y: 0.12, width: 0.88, height: 0.25 }
```

The frontend renders the answer sheet as an `<img>` and overlays absolute-positioned `<div>` elements:
```jsx
<div style={{
  position: 'absolute',
  left: `${region.x * 100}%`,
  top: `${region.y * 100}%`,
  width: `${region.width * 100}%`,
  height: `${region.height * 100}%`,
}} />
```

This approach keeps highlights accurate at any render size or zoom level.

## Testing

```bash
cd server
npm test
# 43 tests — normalizer, mapping algorithm, bounding box utilities
```

## Assumptions

1. Question papers are typed/printed (not handwritten)
2. Students write their question numbers before each answer
3. PDF conversion uses 150 DPI — sufficient for handwriting recognition
4. Gemini free tier: rate limits may apply for large documents

## Limitations

1. Very messy handwriting may reduce OCR accuracy
2. No built-in authentication (can add JWT if needed)
3. Large PDFs (>10 pages) may be slow due to per-page Gemini calls
4. Answer region bounding boxes are AI estimates — may not be pixel-perfect

## Future Improvements

- Batch processing multiple student sheets
- Teacher annotation / manual correction of mappings
- Class-level analytics dashboard
- Export to PDF report
- WebSocket for real-time processing updates
- Caching Gemini responses to avoid redundant calls
