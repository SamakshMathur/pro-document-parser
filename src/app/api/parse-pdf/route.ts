/**
 * PRO Document Parser — PDF Extraction API
 *
 * Strategy (in priority order):
 *   1. pdf-parse (pure JS, zero dependency on Python) — ALWAYS available
 *   2. Python pdfplumber (if installed) — better layout for complex PDFs
 *   3. Python PyMuPDF — richest text + layout information
 *
 * The response is ALWAYS { text: string } — never empty on a valid PDF.
 */

import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';

// ============================================================
// STRATEGY 1 — JS-NATIVE (pdf-parse) — Primary & always-on
// ============================================================
async function extractWithPdfParse(buffer: Buffer): Promise<string> {
  // pdf-parse is a CJS module — use require-style dynamic import
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = require('pdf-parse');
  const result = await pdfParse(buffer, {
    // Custom page renderer to preserve line breaks and whitespace
    pagerender: (pageData: any) => {
      return pageData.getTextContent().then((textContent: any) => {
        let lastY = -1;
        let text = '';
        for (const item of textContent.items as any[]) {
          if (lastY !== item.transform[5] && lastY !== -1) {
            text += '\n';
          }
          text += item.str;
          lastY = item.transform[5];
        }
        return text;
      });
    },
  });
  return result.text || '';
}

// ============================================================
// STRATEGY 2+3 — Python fallback (optional enhancement)
// ============================================================
async function extractWithPython(filePath: string): Promise<string> {
  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const execAsync = promisify(exec);

  const scriptPath = path.join(process.cwd(), 'scripts', 'pdf_extractor.py');
  const { stdout } = await execAsync(`python "${scriptPath}" "${filePath}"`);
  const result = JSON.parse(stdout);
  if (result.success && result.text && result.text.trim().length > 50) {
    console.log(`Extracted via Python (${result.strategy}): ${result.text.length} chars`);
    return result.text;
  }
  return '';
}

// ============================================================
// POST HANDLER
// ============================================================
export async function POST(req: NextRequest) {
  let tempFilePath = '';

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // --- Strategy 1: pdf-parse (JS-native, no Python required) ---
    let extractedText = '';
    try {
      extractedText = await extractWithPdfParse(buffer);
      console.log(`[pdf-parse] Extracted ${extractedText.length} chars`);
    } catch (jsErr) {
      console.warn('[pdf-parse] Failed, will try Python:', jsErr);
    }

    // --- Strategy 2: Python (only if JS gave < 100 chars of real text) ---
    if (extractedText.trim().length < 100) {
      try {
        const tempDir = os.tmpdir();
        tempFilePath = path.join(tempDir, `upload-${Date.now()}.pdf`);
        await fs.writeFile(tempFilePath, buffer);
        const pyText = await extractWithPython(tempFilePath);
        if (pyText.trim().length > extractedText.trim().length) {
          extractedText = pyText;
        }
      } catch (pyErr) {
        console.warn('[Python] PDF extraction failed (optional):', pyErr);
      }
    }

    // --- Last resort: return whatever we have ---
    if (!extractedText || extractedText.trim().length === 0) {
      console.error('[PDF API] No text could be extracted from this PDF');
      return NextResponse.json({
        text: '',
        error: 'Could not extract text. The PDF may be image-based (scanned). Try converting it to JPG/PNG first.',
      }, { status: 200 }); // 200 so client can show the error gracefully
    }

    return NextResponse.json({ text: extractedText.trim() });

  } catch (error) {
    console.error('[PDF API] Unhandled error:', error);
    return NextResponse.json({
      text: '',
      error: 'PDF processing failed',
      details: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  } finally {
    if (tempFilePath) {
      try { await fs.unlink(tempFilePath); } catch {}
    }
  }
}
