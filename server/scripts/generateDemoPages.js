/**
 * Regenerates the demo answer-sheet page images referenced by demo.json.
 * Run with: node scripts/generateDemoPages.js
 */
const fs = require('fs');
const path = require('path');
const { createCanvas } = require('@napi-rs/canvas');

const demo = require('../src/data/demo.json');

const OUTPUT_DIR = path.join(__dirname, '../src/data/demo');
const WIDTH = 1200;
const HEIGHT = 1600;

const wrapText = (ctx, text, maxWidth) => {
  const lines = [];
  for (const paragraph of text.split('\n')) {
    let line = '';
    for (const word of paragraph.split(/\s+/)) {
      const candidate = line ? `${line} ${word}` : word;
      if (ctx.measureText(candidate).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    lines.push(line);
  }
  return lines;
};

const collectBlocks = () => {
  const blocks = [];
  for (const mapping of demo.mappings) {
    for (const region of mapping.answerRegions || []) {
      blocks.push({ region, label: mapping.questionDisplayLabel, text: mapping.answerText || '' });
    }
  }
  for (const unmatched of demo.unmatchedAnswers || []) {
    for (const region of unmatched.regions || []) {
      blocks.push({ region, label: unmatched.questionNumber || '?', text: unmatched.text || '' });
    }
  }
  return blocks;
};

const drawPage = (pageNumber, blocks) => {
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#fdfcf7';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.strokeStyle = '#dfe6ef';
  ctx.lineWidth = 1;
  for (let y = 120; y < HEIGHT; y += 44) {
    ctx.beginPath();
    ctx.moveTo(60, y);
    ctx.lineTo(WIDTH - 60, y);
    ctx.stroke();
  }
  ctx.strokeStyle = '#f0b8b8';
  ctx.beginPath();
  ctx.moveTo(100, 0);
  ctx.lineTo(100, HEIGHT);
  ctx.stroke();

  ctx.fillStyle = '#94a3b8';
  ctx.font = '20px sans-serif';
  ctx.fillText(`Page ${pageNumber}`, WIDTH - 160, HEIGHT - 40);

  for (const { region, label, text } of blocks) {
    const x = region.x * WIDTH;
    const y = region.y * HEIGHT;
    const w = region.width * WIDTH;

    ctx.fillStyle = '#1d4ed8';
    ctx.font = 'bold 30px sans-serif';
    ctx.fillText(`${label}.`, x, y + 30);

    ctx.fillStyle = '#1f2937';
    ctx.font = 'italic 24px sans-serif';
    let lineY = y + 74;
    for (const line of wrapText(ctx, text, w - 20)) {
      ctx.fillText(line, x + 12, lineY);
      lineY += 34;
    }
  }

  return canvas.toBuffer('image/png');
};

fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const blocks = collectBlocks();
const pageNumbers = [...new Set(blocks.map((b) => b.region.pageNumber))].sort((a, b) => a - b);

for (const pageNumber of pageNumbers) {
  const pageBlocks = blocks.filter((b) => b.region.pageNumber === pageNumber);
  const outputPath = path.join(OUTPUT_DIR, `answer_page${pageNumber}.png`);
  fs.writeFileSync(outputPath, drawPage(pageNumber, pageBlocks));
  console.log(`wrote ${outputPath}`);
}
