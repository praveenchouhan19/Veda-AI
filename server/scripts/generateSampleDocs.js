/**
 * Generates a sample question paper and a matching handwritten answer sheet
 * for testing the extraction → mapping → grading pipeline.
 *
 * The answer sheet deliberately exercises every mapping branch:
 *   - answers written out of order
 *   - a question left completely unanswered
 *   - sub-parts 11(a)/11(b) answered as one block labelled "11"
 *   - an answer spanning a page break
 *   - an answer labelled with a question number that does not exist
 *
 * Run with: node scripts/generateSampleDocs.js
 */
const fs = require('fs');
const path = require('path');
const { createCanvas, GlobalFonts } = require('@napi-rs/canvas');

const OUTPUT_DIR = path.join(__dirname, '../../samples');
const PAGE_W = 612;
const PAGE_H = 792;
const SCALE = 2;
const W = PAGE_W * SCALE;
const H = PAGE_H * SCALE;

const HAND_FONT = '/System/Library/Fonts/Supplemental/Bradley Hand Bold.ttf';
let handFamily = 'sans-serif';
if (fs.existsSync(HAND_FONT) && GlobalFonts.registerFromPath(HAND_FONT, 'HandWriting')) {
  handFamily = 'HandWriting';
}

// ---------------------------------------------------------------- PDF writer

/**
 * Assemble JPEG page images into a multi-page PDF using DCTDecode XObjects.
 */
const buildPdf = (jpegPages) => {
  const objects = [];
  const addObject = (body) => {
    objects.push(Buffer.isBuffer(body) ? body : Buffer.from(body, 'latin1'));
    return objects.length; // 1-based object number
  };

  const catalogNum = 1;
  const pagesNum = 2;
  objects.push(Buffer.alloc(0), Buffer.alloc(0)); // reserve 1 and 2

  const kids = [];
  for (const jpeg of jpegPages) {
    const imageNum = addObject(
      Buffer.concat([
        Buffer.from(
          `<< /Type /XObject /Subtype /Image /Width ${jpeg.width} /Height ${jpeg.height} ` +
            `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.data.length} >>\nstream\n`,
          'latin1'
        ),
        jpeg.data,
        Buffer.from('\nendstream', 'latin1'),
      ])
    );

    const stream = `q ${PAGE_W} 0 0 ${PAGE_H} 0 0 cm /Im0 Do Q`;
    const contentNum = addObject(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);

    const pageNum = addObject(
      `<< /Type /Page /Parent ${pagesNum} 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] ` +
        `/Resources << /XObject << /Im0 ${imageNum} 0 R >> >> /Contents ${contentNum} 0 R >>`
    );
    kids.push(`${pageNum} 0 R`);
  }

  objects[catalogNum - 1] = Buffer.from(`<< /Type /Catalog /Pages ${pagesNum} 0 R >>`, 'latin1');
  objects[pagesNum - 1] = Buffer.from(
    `<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${kids.length} >>`,
    'latin1'
  );

  const parts = [Buffer.from('%PDF-1.4\n', 'latin1')];
  let cursor = parts[0].length;
  const offsets = [];

  objects.forEach((body, index) => {
    offsets[index] = cursor;
    const chunk = Buffer.concat([
      Buffer.from(`${index + 1} 0 obj\n`, 'latin1'),
      body,
      Buffer.from('\nendobj\n', 'latin1'),
    ]);
    parts.push(chunk);
    cursor += chunk.length;
  });

  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) xref += `${String(offset).padStart(10, '0')} 00000 n \n`;
  xref += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogNum} 0 R >>\nstartxref\n${cursor}\n%%EOF`;
  parts.push(Buffer.from(xref, 'latin1'));

  return Buffer.concat(parts);
};

// ------------------------------------------------------------- drawing utils

const wrap = (ctx, text, maxWidth) => {
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

// ------------------------------------------------------------ question paper

const QUESTIONS = [
  { n: '1.', marks: 2, text: 'Which blood vessel carries blood away from the heart?' },
  { n: '2.', marks: 2, text: 'Which of the following organelles is primarily involved in photosynthesis?' },
  { n: '3.', marks: 2, text: 'Explain the role of chloroplasts in photosynthesis, naming the main pigments involved and briefly outlining the two major stages of the process.' },
  { n: '4.', marks: 2, text: 'Describe the flow of blood through the human heart, starting from the right atrium and ending at the aorta. Include the names of the valves crossed.' },
  { n: '5.', marks: 2, text: 'Draw a labelled diagram of an alveolus showing capillaries, air space and the direction of gas exchange.' },
  { n: '6.', marks: 5, text: 'Draw a neat labelled diagram of the human digestive system (stomach, small intestine, large intestine, liver, pancreas) and label the site where most absorption occurs.' },
  { n: '7.', marks: 5, text: 'Draw and label a nephron (Bowman\u2019s capsule, glomerulus, proximal tubule, loop of Henle, distal tubule, collecting duct).' },
  { n: '8.', marks: 5, text: 'Explain the structural differences between palisade mesophyll and spongy mesophyll, and state how each structure aids its function in the leaf.' },
  { n: '9.', marks: 5, text: 'Describe the process of transpiration in two to three sentences and name two environmental factors that increase its rate.' },
  { n: '10.', marks: 5, text: 'Explain how the structure of xylem vessels facilitates water transport in plants, mentioning one structural feature and what it does.' },
  { n: '11. (a)', marks: 2, text: 'A diagram shows two potted plants \u2014 Plant A is in bright light with broad green leaves, Plant B is kept in dim light with pale, elongated leaves. State one reason for the difference.' },
  { n: '11. (b)', marks: 3, text: 'Suggest one practical measure to help Plant B recover.' },
  { n: '12.', marks: 4, text: 'A resting person has a tidal volume of 0.5 L and breathes 12 times per minute. Calculate the pulmonary ventilation rate.' },
  { n: '13.', marks: 5, text: 'If dead space is 0.15 L per breath, calculate the alveolar ventilation per minute. Show your working.' },
];

const drawQuestionPage = (items, pageNumber, totalPages, isFirst) => {
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  let y = 90;
  const left = 90;
  const right = W - 90;
  const marksColumn = 90; // keep the [n] marks clear of the question text
  const bodyWidth = right - left - 90 - marksColumn;

  if (isFirst) {
    ctx.fillStyle = '#111111';
    ctx.textAlign = 'center';
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText('DELHI PUBLIC SCHOOL, BOKARO STEEL CITY', W / 2, y);
    ctx.font = '30px sans-serif';
    ctx.fillText('Class X \u2014 Biology \u2014 Unit Test', W / 2, y + 46);
    ctx.font = '24px sans-serif';
    ctx.fillText('Time: 1 hour                    Maximum Marks: 47', W / 2, y + 88);
    ctx.textAlign = 'left';

    ctx.strokeStyle = '#111111';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(left, y + 116);
    ctx.lineTo(right, y + 116);
    ctx.stroke();

    ctx.font = 'italic 22px sans-serif';
    ctx.fillText('Answer all questions. Marks are shown in brackets.', left, y + 152);
    y += 200;
  }

  for (const item of items) {
    ctx.fillStyle = '#111111';
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText(item.n, left, y);

    ctx.font = '26px sans-serif';
    const lines = wrap(ctx, item.text, bodyWidth);
    lines.forEach((line, index) => ctx.fillText(line, left + 90, y + index * 36));

    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`[${item.marks}]`, right, y);
    ctx.textAlign = 'left';

    y += lines.length * 36 + 34;
  }

  ctx.fillStyle = '#666666';
  ctx.font = '22px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`Page ${pageNumber} of ${totalPages}`, W / 2, H - 60);
  ctx.textAlign = 'left';

  return { data: canvas.toBuffer('image/jpeg', 88), width: W, height: H };
};

// --------------------------------------------------------------- answer sheet

const ANSWER_BLOCKS = [
  // Deliberately out of order: Q3 is answered before Q1.
  { page: 1, label: 'Q3.', text: 'Chloroplasts are the organelles where photosynthesis happens.\nThe main pigment is chlorophyll a and b, also carotenoids.\nStage 1 - Light reaction: captures light energy in the thylakoid.\nStage 2 - Dark reaction (Calvin cycle): uses that energy to make glucose in the stroma.' },
  { page: 1, label: 'Q1.', text: 'The artery carries blood away from the heart. The main one is the aorta.' },
  { page: 1, label: 'Q2.', text: 'The chloroplast is the organelle involved in photosynthesis.' },

  // Q4 is skipped entirely — should come back as "unanswered".
  { page: 2, label: 'Q5.', text: '[Diagram: alveolus drawn as a round sac with capillaries wrapped around it]\nLabels: air space, alveolar wall, capillary, O2 in, CO2 out.\nGas exchange happens by diffusion across the thin wall.' },
  { page: 2, label: 'Q8.', text: 'Palisade mesophyll is at the top, cells are long and packed tightly with many\nchloroplasts, so it absorbs the most light.\nSpongy mesophyll is below, cells are round with big air spaces between them,\nwhich lets gases diffuse easily to the stomata.' },

  // Spans the page break: the block starts on page 3 and continues on page 4.
  { page: 3, label: 'Q6.', text: '[Diagram: human digestive system]\nLabelled - mouth, oesophagus, stomach, liver, pancreas,\nsmall intestine, large intestine, rectum.\nThe stomach churns food with acid and pepsin.' },
  { page: 3, label: 'Q9.', text: 'Transpiration is the loss of water vapour from the leaves through the stomata.\nWater moves up the xylem to replace it. Two factors that increase the rate are\nhigh temperature and moving air (wind).' },

  { page: 4, label: '', text: '...continued from Q6\nMost absorption happens in the small intestine, in the ileum,\nbecause of the villi which give a huge surface area.', continues: true },
  // 11(a) and 11(b) answered together as one block labelled just "11".
  { page: 4, label: '11.', text: 'Plant B was kept in dim light so it could not photosynthesise properly,\nthat is why the leaves are pale and stretched out looking for light.\nTo help it recover, move Plant B to a bright spot with indirect sunlight\nand water it normally.' },
  // A question number that does not exist on the paper.
  { page: 4, label: 'Q14.', text: 'Rough work: 0.5 x 12 = 6 L/min\n0.5 - 0.15 = 0.35, 0.35 x 12 = 4.2 L/min' },
];

const drawAnswerPage = (blocks, pageNumber, totalPages) => {
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // Ruled exercise paper
  ctx.fillStyle = '#fdfcf6';
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#cfe0ef';
  ctx.lineWidth = 1.5;
  for (let y = 150; y < H - 60; y += 46) {
    ctx.beginPath();
    ctx.moveTo(90, y);
    ctx.lineTo(W - 70, y);
    ctx.stroke();
  }
  ctx.strokeStyle = '#f0b6b6';
  ctx.beginPath();
  ctx.moveTo(150, 0);
  ctx.lineTo(150, H);
  ctx.stroke();

  if (pageNumber === 1) {
    ctx.fillStyle = '#1a1a6a';
    ctx.font = `36px "${handFamily}"`;
    ctx.fillText('Name: Ananya Sharma      Class: X-B      Roll No: 24', 170, 110);
  }

  let y = pageNumber === 1 ? 240 : 190;

  for (const block of blocks) {
    if (block.label) {
      ctx.fillStyle = '#1a1a6a';
      ctx.font = `bold 40px "${handFamily}"`;
      ctx.fillText(block.label, 165, y);
    }

    ctx.fillStyle = '#20208a';
    ctx.font = `34px "${handFamily}"`;
    const lines = wrap(ctx, block.text, W - 420);
    lines.forEach((line, index) => ctx.fillText(line, block.label ? 300 : 200, y + index * 46));

    y += lines.length * 46 + 70;
  }

  ctx.fillStyle = '#8a8a8a';
  ctx.font = '22px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${pageNumber} / ${totalPages}`, W / 2, H - 40);
  ctx.textAlign = 'left';

  return { data: canvas.toBuffer('image/jpeg', 88), width: W, height: H };
};

// --------------------------------------------------------------------- output

fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const questionPageGroups = [QUESTIONS.slice(0, 8), QUESTIONS.slice(8)];
const questionPages = questionPageGroups.map((group, index) =>
  drawQuestionPage(group, index + 1, questionPageGroups.length, index === 0)
);

const answerPageNumbers = [...new Set(ANSWER_BLOCKS.map((b) => b.page))].sort((a, b) => a - b);
const answerPages = answerPageNumbers.map((pageNumber) =>
  drawAnswerPage(
    ANSWER_BLOCKS.filter((b) => b.page === pageNumber),
    pageNumber,
    answerPageNumbers.length
  )
);

const questionPath = path.join(OUTPUT_DIR, 'question_paper.pdf');
const answerPath = path.join(OUTPUT_DIR, 'answer_sheet.pdf');

fs.writeFileSync(questionPath, buildPdf(questionPages));
fs.writeFileSync(answerPath, buildPdf(answerPages));

console.log(`Question paper: ${questionPath} (${questionPages.length} pages, ${QUESTIONS.length} questions)`);
console.log(`Answer sheet:   ${answerPath} (${answerPages.length} pages, ${ANSWER_BLOCKS.length} blocks)`);
console.log(`Handwriting font: ${handFamily}`);
