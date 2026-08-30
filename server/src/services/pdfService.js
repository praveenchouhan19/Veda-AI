const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const config = require('../config');

const UPLOAD_DIR = path.join(__dirname, '../../', config.uploadDir);

/**
 * Determine if a file is a PDF by extension.
 */
const isPdf = (filePath) => {
  return path.extname(filePath).toLowerCase() === '.pdf';
};

/**
 * Convert a PDF file to an array of PNG image paths (one per page).
 * Uses pure JS pdf-img-convert with fallback to pdf2pic or direct PDF.
 */
const pdfToImages = async (pdfPath, prefix) => {
  const outputDir = path.join(UPLOAD_DIR, prefix);
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  // 1. Try pure JS pdf-img-convert (no native binaries required)
  try {
    const pdfImgConvert = require('pdf-img-convert');
    const pageData = await pdfImgConvert.convert(pdfPath, { width: 1200 });

    if (pageData && pageData.length > 0) {
      const results = [];
      for (let i = 0; i < pageData.length; i++) {
        const imagePath = path.join(outputDir, `page.${i + 1}.png`);
        fs.writeFileSync(imagePath, pageData[i]);
        results.push({
          imagePath,
          pageNumber: i + 1,
        });
      }
      return results;
    }
  } catch (err1) {
    console.warn('⚠️ pdf-img-convert failed, trying pdf2pic:', err1.message);
  }

  // 2. Try pdf2pic if system has GraphicsMagick/ImageMagick installed
  try {
    const { fromPath } = require('pdf2pic');
    const options = {
      density: 150,
      saveFilename: 'page',
      savePath: outputDir,
      format: 'png',
      width: 1200,
      height: 1600,
    };
    const convert = fromPath(pdfPath, options);
    const result = await convert.bulk(-1, { responseType: 'image' });

    if (result && result.length > 0) {
      return result.map((r, i) => ({
        imagePath: r.path,
        pageNumber: i + 1,
      }));
    }
  } catch (err2) {
    console.warn('⚠️ pdf2pic failed, sending PDF directly to Gemini:', err2.message);
  }

  // 3. Fallback: Copy PDF directly for Gemini native PDF processing
  const outputPath = path.join(outputDir, 'page.1.pdf');
  fs.copyFileSync(pdfPath, outputPath);
  return [{ imagePath: outputPath, pageNumber: 1, isPdfDirect: true }];
};

/**
 * For an image file (PNG/JPG), resize and return as a single page.
 */
const imageToPageImage = async (imagePath, prefix) => {
  const outputDir = path.join(UPLOAD_DIR, prefix);
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const outputPath = path.join(outputDir, 'page.1.png');

  await sharp(imagePath)
    .resize({ width: 1200, withoutEnlargement: true })
    .png()
    .toFile(outputPath);

  return [{ imagePath: outputPath, pageNumber: 1 }];
};

/**
 * Process a file (PDF or image) into page images/files for AI analysis.
 * Returns [{ imagePath, pageNumber, isPdfDirect? }]
 */
const processFileToPages = async (filePath, prefix) => {
  if (isPdf(filePath)) {
    return await pdfToImages(filePath, prefix);
  } else {
    return await imageToPageImage(filePath, prefix);
  }
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
