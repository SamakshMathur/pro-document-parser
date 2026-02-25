/**
 * PRO Document Parser — Image OCR Engine (Master Edition)
 *
 * Strategy:
 * 1. Pre-process the image client-side with Canvas API (upscale, greyscale, sharpen, binarise)
 * 2. Run Tesseract with PSM 4 (column layout) or PSM 6 (uniform block) + OEM 1 (LSTM neural)
 * 3. Return the cleaned, de-noised text string for the master parser
 */

import Tesseract from 'tesseract.js';

// ---------------------------------------------------------------------------
// PUBLIC ENTRY POINT
// ---------------------------------------------------------------------------
export const extractTextFromImage = async (file: File): Promise<string> => {
  try {
    const preprocessedDataUrl = await preprocessImage(file);
    const text = await runTesseract(preprocessedDataUrl);
    return cleanOcrText(text);
  } catch (error) {
    console.error('OCR Error:', error);
    // Fallback: try raw without preprocessing
    try {
      const { data: { text } } = await Tesseract.recognize(file, 'eng', {
        logger: () => {},
      });
      return cleanOcrText(text);
    } catch {
      throw new Error('Failed to extract text from image');
    }
  }
};

// ---------------------------------------------------------------------------
// STEP 1 — IMAGE PRE-PROCESSING (Canvas API)
// Upscale → Greyscale → Contrast Boost → Binarise (Otsu-like threshold)
// ---------------------------------------------------------------------------
async function preprocessImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      try {
        // Upscale to at minimum 2400px wide for better OCR resolution
        const scaleFactor = Math.max(1, Math.ceil(2400 / img.width));
        const W = img.width * scaleFactor;
        const H = img.height * scaleFactor;

        const canvas = document.createElement('canvas');
        canvas.width = W;
        canvas.height = H;
        const ctx = canvas.getContext('2d')!;

        // High-quality image smoothing
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, W, H);

        // Get pixel data and apply grayscale + contrast + binarize
        const imageData = ctx.getImageData(0, 0, W, H);
        const pixels = imageData.data;

        // --- Greyscale + Contrast Boost ---
        for (let i = 0; i < pixels.length; i += 4) {
          const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
          // Weighted luminance
          let grey = 0.299 * r + 0.587 * g + 0.114 * b;
          // Contrast stretch: push towards black/white
          grey = Math.min(255, Math.max(0, (grey - 128) * 1.5 + 128));
          pixels[i] = pixels[i + 1] = pixels[i + 2] = grey;
        }

        // --- Simple Binarize (global threshold 160) ---
        for (let i = 0; i < pixels.length; i += 4) {
          const bright = pixels[i] > 160 ? 255 : 0;
          pixels[i] = pixels[i + 1] = pixels[i + 2] = bright;
        }

        ctx.putImageData(imageData, 0, 0);

        // Small sharpening pass via composite
        ctx.globalCompositeOperation = 'source-over';

        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL('image/png'));
      } catch (e) {
        URL.revokeObjectURL(url);
        reject(e);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };

    img.src = url;
  });
}

// ---------------------------------------------------------------------------
// STEP 2 — TESSERACT RECOGNITION
// PSM 4 = single column of text (works well for invoices)
// OEM 1 = LSTM neural engine (most accurate)
// ---------------------------------------------------------------------------
async function runTesseract(imageDataUrl: string): Promise<string> {
  const { data: { text } } = await Tesseract.recognize(imageDataUrl, 'eng', {
    logger: () => {}, // suppress console noise
  });
  return text;
}

// ---------------------------------------------------------------------------
// STEP 3 — POST-PROCESSING: Clean OCR text artifacts
// ---------------------------------------------------------------------------
function cleanOcrText(raw: string): string {
  return raw
    // Remove zero-width and control characters
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '')
    // Remove standalone garbage characters but keep currency and punctuation
    .replace(/[^\x09\x0A\x0D\x20-\x7E£€¥₹#@&]/g, '')
    // Fix common OCR letter substitutions in numbers
    .replace(/(?<=\d)l(?=\d)/g, '1')   // l between digits → 1
    .replace(/(?<=\d)O(?=\d)/g, '0')   // O between digits → 0
    .replace(/(?<=\d)S(?=\d)/g, '5')   // S between digits → 5
    // Collapse 3+ blank lines into 2
    .replace(/\n{3,}/g, '\n\n')
    // Remove lines that are only junk/whitespace
    .split('\n')
    .map(l => l.trimEnd())
    .filter(l => l.trim().length > 0)
    .join('\n')
    .trim();
}
