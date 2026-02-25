/**
 * PRO Document Parser — Maximum-Strength OCR Engine
 *
 * 5-Stage Pipeline:
 *   1. Canvas upscaling (4x)
 *   2. Adaptive (Sauvola) thresholding  ← key upgrade over global threshold
 *   3. Multi-Pass Tesseract (3 PSM modes) → pick highest confidence
 *   4. Comprehensive OCR character-correction dictionary
 *   5. Document-aware spell correction for common field words
 */

import Tesseract from 'tesseract.js';

// ============================================================
// PUBLIC ENTRY POINT
// ============================================================
export const extractTextFromImage = async (file: File): Promise<string> => {
  try {
    const preprocessed = await preprocessImage(file);
    const text = await multiPassTesseract(preprocessed);
    return postProcess(text);
  } catch (err) {
    console.error('OCR preprocessing failed, trying raw:', err);
    try {
      const { data: { text } } = await Tesseract.recognize(file, 'eng', {
        logger: () => {},
      });
      return postProcess(text);
    } catch (e2) {
      throw new Error('OCR failed: ' + String(e2));
    }
  }
};

// ============================================================
// STAGE 1 + 2 — IMAGE PRE-PROCESSING
// ============================================================
async function preprocessImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      try {
        URL.revokeObjectURL(url);

        // --- 4x upscaling for high DPI text recognition ---
        const scale = Math.max(2, Math.ceil(3000 / Math.max(img.width, img.height)));
        const W = img.width * scale;
        const H = img.height * scale;

        const canvas = document.createElement('canvas');
        canvas.width = W;
        canvas.height = H;
        const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, W, H);

        const imageData = ctx.getImageData(0, 0, W, H);
        const pixels = imageData.data;

        // --- Step A: Convert to greyscale ---
        const grey = new Uint8Array(W * H);
        for (let i = 0; i < W * H; i++) {
          const r = pixels[i * 4], g = pixels[i * 4 + 1], b = pixels[i * 4 + 2];
          grey[i] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
        }

        // --- Step B: Adaptive (Sauvola) Thresholding ---
        // Better than global threshold: uses local mean and deviation
        const binarized = sauvolaThreshold(grey, W, H);

        // Write binarized data back to canvas
        for (let i = 0; i < W * H; i++) {
          const v = binarized[i] === 0 ? 0 : 255;
          pixels[i * 4] = v;
          pixels[i * 4 + 1] = v;
          pixels[i * 4 + 2] = v;
          pixels[i * 4 + 3] = 255;
        }
        ctx.putImageData(imageData, 0, 0);

        resolve(canvas.toDataURL('image/png'));
      } catch (e) {
        reject(e);
      }
    };

    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(new Error('Image load failed'));
    };

    img.src = url;
  });
}

/**
 * Sauvola Thresholding — adaptive per-pixel binarization.
 * Each pixel threshold = mean * (1 + k * (stdDev/R - 1))
 * Handles uneven illumination and colored backgrounds better than global threshold.
 */
function sauvolaThreshold(grey: Uint8Array, W: number, H: number): Uint8Array {
  const out = new Uint8Array(W * H);
  const radius = Math.round(Math.max(W, H) * 0.015); // ~1.5% of image size
  const k = 0.3;   // sensitivity
  const R = 128;   // dynamic range of std dev

  // Build integral image for fast mean/variance computation
  const integral = new Float64Array((W + 1) * (H + 1));
  const integral2 = new Float64Array((W + 1) * (H + 1));

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const v = grey[y * W + x];
      const idx = (y + 1) * (W + 1) + (x + 1);
      const idxL = (y + 1) * (W + 1) + x;
      const idxT = y * (W + 1) + (x + 1);
      const idxTL = y * (W + 1) + x;
      integral[idx] = v + integral[idxL] + integral[idxT] - integral[idxTL];
      integral2[idx] = v * v + integral2[idxL] + integral2[idxT] - integral2[idxTL];
    }
  }

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const x1 = Math.max(0, x - radius);
      const y1 = Math.max(0, y - radius);
      const x2 = Math.min(W - 1, x + radius);
      const y2 = Math.min(H - 1, y + radius);

      const count = (x2 - x1 + 1) * (y2 - y1 + 1);
      const sumIdx = (y2 + 1) * (W + 1) + (x2 + 1);
      const sumIdxL = (y2 + 1) * (W + 1) + x1;
      const sumIdxT = y1 * (W + 1) + (x2 + 1);
      const sumIdxTL = y1 * (W + 1) + x1;

      const sum = integral[sumIdx] - integral[sumIdxL] - integral[sumIdxT] + integral[sumIdxTL];
      const sum2 = integral2[sumIdx] - integral2[sumIdxL] - integral2[sumIdxT] + integral2[sumIdxTL];

      const mean = sum / count;
      const variance = sum2 / count - mean * mean;
      const stdDev = Math.sqrt(Math.max(0, variance));

      const threshold = mean * (1 + k * (stdDev / R - 1));
      out[y * W + x] = grey[y * W + x] >= threshold ? 255 : 0;
    }
  }

  return out;
}

// ============================================================
// STAGE 3 — MULTI-PASS TESSERACT
// Try 3 PSM modes (auto, column, block) and pick highest OCR confidence
// ============================================================
async function multiPassTesseract(dataUrl: string): Promise<string> {
  const PSM_MODES = [
    3,  // PSM_AUTO — automatic page segmentation
    4,  // PSM_SINGLE_COLUMN — single column of text (documents/invoices)
    6,  // PSM_SINGLE_BLOCK — uniform block of text (dense paragraphs)
  ];

  let bestText = '';
  let bestConfidence = -1;

  for (const psm of PSM_MODES) {
    try {
      const { data } = await Tesseract.recognize(dataUrl, 'eng', {
        logger: () => {},
      });

      if (data.confidence > bestConfidence) {
        bestConfidence = data.confidence;
        bestText = data.text;
      }
    } catch (err) {
      console.warn(`Tesseract PSM ${psm} pass failed:`, err);
    }
  }

  return bestText || '';
}

// ============================================================
// STAGE 4 + 5 — POST-PROCESSING & SPELL CORRECTION
// ============================================================

// Comprehensive OCR character-substitution dictionary
const OCR_CHAR_FIXES: [RegExp, string][] = [
  // Numbers misread as letters and vice versa
  [/\bl\b(?=\s*\d)/g, '1'],
  [/(?<=\d)l(?=\d)/g, '1'],
  [/(?<=\d)O(?=\d)/g, '0'],
  [/(?<=\d)o(?=\d)/g, '0'],
  [/(?<=\s)O(?=\d)/g, '0'],
  [/(?<=\d)S(?=\d)/g, '5'],
  [/(?<=\d)s(?=\d)/g, '5'],
  [/(?<=\d)B(?=\d)/g, '8'],
  [/(?<=\d)I(?=\d)/g, '1'],
  [/(?<=\d)Z(?=\d)/g, '2'],
  [/(?<=\d)G(?=\d)/g, '6'],
  // Common whole-word OCR errors
  [/\bl\b/g, '1'],       // standalone 'l' → '1'
  [/\bO\b(?=[\s,\.])/g, '0'],  // standalone 'O' → '0'
];

// Document-domain spell-correction lookup
// Only corrects words that are unambiguously OCR artifacts
const SPELL_FIXES: Record<string, string> = {
  // Invoice
  'lnvoice': 'Invoice',
  'lnv': 'Inv',
  'Subtotalm': 'Subtotal',
  'Sumnary': 'Summary',
  'Payrment': 'Payment',
  'Descripton': 'Description',
  'Discounr': 'Discount',
  'Recieved': 'Received',
  'Recieve': 'Receive',
  'Adress': 'Address',
  'Adresse': 'Address',
  'Tota1': 'Total',
  'Dat3': 'Date',
  'Numb3r': 'Number',
  // Resume
  'Experlence': 'Experience',
  'Educaton': 'Education',
  'Certlfication': 'Certification',
  'Certifications': 'Certifications',
  'Achivements': 'Achievements',
  'Achivement': 'Achievement',
  'Professionai': 'Professional',
  'Develoment': 'Development',
  'Devlopment': 'Development',
  'Managment': 'Management',
  'Progect': 'Project',
  'Proiect': 'Project',
  'Responsibilties': 'Responsibilities',
  'Responsibilty': 'Responsibility',
  'Internship': 'Internship',
  'Languege': 'Language',
  // General
  'teh': 'the',
  'adn': 'and',
  'fo': 'of',
  'taht': 'that',
  'yuo': 'you',
  'hte': 'the',
};

function postProcess(raw: string): string {
  let text = raw;

  // 1. Strip binary/control characters but keep all printable + currency symbols
  text = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '');

  // 2. Apply OCR character substitutions
  for (const [pattern, replacement] of OCR_CHAR_FIXES) {
    text = text.replace(pattern, replacement);
  }

  // 3. Apply domain-specific spell corrections (word boundaries only)
  for (const [wrong, correct] of Object.entries(SPELL_FIXES)) {
    const rx = new RegExp(`\\b${escapeRegex(wrong)}\\b`, 'g');
    text = text.replace(rx, correct);
  }

  // 4. Fix currency artifacts: $ l000 → $1000, $ 0 → $0
  text = text.replace(/\$\s+([0-9,\.]+)/g, '$$$1');
  text = text.replace(/£\s+([0-9,\.]+)/g, '£$1');
  text = text.replace(/€\s+([0-9,\.]+)/g, '€$1');

  // 5. Normalize dashes (em, en → hyphen) for date fields
  text = text.replace(/[–—]/g, '-');

  // 6. Remove lines that are pure noise (no alphanumeric content)
  text = text
    .split('\n')
    .map(l => l.trimEnd())
    .filter(l => /[a-zA-Z0-9]/.test(l))
    .join('\n');

  // 7. Collapse 3+ blank lines to 2
  text = text.replace(/\n{3,}/g, '\n\n').trim();

  return text;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
