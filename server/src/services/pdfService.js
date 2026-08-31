const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const config = require('../config');

const UPLOAD_DIR = path.join(__dirname, '../../', config.uploadDir);

// Rasterisation width in px. High enough for Gemini to read handwriting,
// small enough to keep the inline base64 payload within request limits.
const RENDER_WIDTH = 1600;
const MAX_PAGES = 40;

let pdfjsPromise = null;

/**
 * Load pdf.js. It needs these browser globals to rasterise vector paths and
 * glyphs — without them every page renders blank.
 */
const loadPdfjs = () => {
  if (!pdfjsPromise) {
    const nc = require('@napi-rs/canvas');
    if (!globalThis.DOMMatrix) globalThis.DOMMatrix = nc.DOMMatrix;
    if (!globalThis.Path2D) globalThis.Path2D = nc.Path2D;
    if (!globalThis.ImageData) globalThis.ImageData = nc.ImageData;
    pdfjsPromise = import('pdfjs-dist/legacy/build/pdf.mjs');
  }
  return pdfjsPromise;
};

/**
 * Determine if a file is a PDF by extension.
 */
const isPdf = (filePath) => {
  return path.extname(filePath).toLowerCase() === '.pdf';
};

const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
};

/**
 * pdf.js needs a canvas factory to rasterise embedded image XObjects. Its Node
 * default pulls in node-canvas, which clashes with sharp's libvips, so supply
 * one backed by the same @napi-rs/canvas we already use.
 */
class NapiCanvasFactory {
  create(width, height) {
    const { createCanvas } = require('@napi-rs/canvas');
    const canvas = createCanvas(Math.max(1, width), Math.max(1, height));
    return { canvas, context: canvas.getContext('2d') };
  }

  reset(canvasAndContext, width, height) {
    canvasAndContext.canvas.width = Math.max(1, width);
    canvasAndContext.canvas.height = Math.max(1, height);
  }

  destroy(canvasAndContext) {
    canvasAndContext.canvas.width = 0;
    canvasAndContext.canvas.height = 0;
    canvasAndContext.canvas = null;
    canvasAndContext.context = null;
  }
}

/**
 * Render every page of a PDF to a PNG using pdf.js + @napi-rs/canvas.
 * Pure JS with prebuilt binaries — no GraphicsMagick/ImageMagick needed.
 */
const renderPdfWithPdfjs = async (pdfPath, outputDir) => {
  const pdfjs = await loadPdfjs();
  const { createCanvas } = require('@napi-rs/canvas');
  const pdfjsRoot = path.dirname(require.resolve('pdfjs-dist/package.json'));

  const doc = await pdfjs.getDocument({
    data: new Uint8Array(fs.readFileSync(pdfPath)),
    isEvalSupported: false,
    useSystemFonts: true,
    CanvasFactory: NapiCanvasFactory,
    standardFontDataUrl: path.join(pdfjsRoot, 'standard_fonts') + path.sep,
    cMapUrl: path.join(pdfjsRoot, 'cmaps') + path.sep,
    cMapPacked: true,
  }).promise;

  const pageCount = Math.min(doc.numPages, MAX_PAGES);
  const results = [];

  for (let i = 1; i <= pageCount; i++) {
    const page = await doc.getPage(i);
    const baseViewport = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: RENDER_WIDTH / baseViewport.width });

    const canvas = createCanvas(Math.floor(viewport.width), Math.floor(viewport.height));
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, viewport.width, viewport.height);

    await page.render({ canvasContext: ctx, viewport }).promise;

    const imagePath = path.join(outputDir, `page.${i}.png`);
    fs.writeFileSync(imagePath, canvas.toBuffer('image/png'));
    page.cleanup();

    results.push({
      imagePath,
      pageNumber: i,
      width: canvas.width,
      height: canvas.height,
    });
  }

  await doc.destroy();
  return results;
};

/**
 * Fallback for PDFs pdf.js cannot parse. Needs GraphicsMagick/ImageMagick.
 */
const renderPdfWithPdf2pic = async (pdfPath, outputDir) => {
  const { fromPath } = require('pdf2pic');
  const convert = fromPath(pdfPath, {
    density: 150,
    saveFilename: 'page',
    savePath: outputDir,
    format: 'png',
    width: RENDER_WIDTH,
    preserveAspectRatio: true,
  });

  const result = await convert.bulk(-1, { responseType: 'image' });
  if (!result || result.length === 0) throw new Error('pdf2pic produced no pages');

  return result.slice(0, MAX_PAGES).map((r, i) => ({
    imagePath: r.path,
    pageNumber: i + 1,
  }));
};

/**
 * Convert a PDF file to an array of PNG image paths (one per page).
 */
const pdfToImages = async (pdfPath, prefix) => {
  const outputDir = ensureDir(path.join(UPLOAD_DIR, prefix));

  try {
    const pages = await renderPdfWithPdfjs(pdfPath, outputDir);
    if (pages.length > 0) return pages;
    throw new Error('pdf.js produced no pages');
  } catch (err) {
    console.warn(`⚠️ pdf.js render failed (${err.message}), trying pdf2pic...`);
  }

  try {
    return await renderPdfWithPdf2pic(pdfPath, outputDir);
  } catch (err) {
    throw new Error(
      `Could not convert PDF to images: ${err.message}. ` +
        'The file may be corrupt, empty or password protected.'
    );
  }
};

/**
 * For an image file (PNG/JPG), resize and return as a single page.
 */
const imageToPageImage = async (imagePath, prefix) => {
  const outputDir = ensureDir(path.join(UPLOAD_DIR, prefix));
  const outputPath = path.join(outputDir, 'page.1.png');

  const info = await sharp(imagePath)
    .rotate() // apply EXIF orientation, otherwise bounding boxes land sideways
    .resize({ width: RENDER_WIDTH, withoutEnlargement: true })
    .png()
    .toFile(outputPath);

  return [{ imagePath: outputPath, pageNumber: 1, width: info.width, height: info.height }];
};

/**
 * Process a file (PDF or image) into page images for AI analysis.
 * Always returns real PNGs so the client can overlay bounding boxes.
 * Returns [{ imagePath, pageNumber, width?, height? }]
 */
const processFileToPages = async (filePath, prefix) => {
  if (!fs.existsSync(filePath)) throw new Error(`File not found: ${filePath}`);
  return isPdf(filePath) ? pdfToImages(filePath, prefix) : imageToPageImage(filePath, prefix);
};

/**
 * Get public URL for a processed image.
 */
const getPublicUrl = (imagePath) => {
  const relative = path.relative(UPLOAD_DIR, imagePath).replace(/\\/g, '/');
  return `/uploads/${relative}`;
};

/**
 * Clean up uploaded files and processed images.
 */
const cleanupFiles = (prefix) => {
  const outputDir = path.join(UPLOAD_DIR, prefix);
  if (fs.existsSync(outputDir)) {
    fs.rmSync(outputDir, { recursive: true, force: true });
  }
};

module.exports = {
  processFileToPages,
  getPublicUrl,
  cleanupFiles,
  isPdf,
};
