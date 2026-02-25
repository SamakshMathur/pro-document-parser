import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';

const execAsync = promisify(exec);

export async function POST(req: NextRequest) {
  let tempFilePath = '';
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Save strictly to a temp file
    const buffer = Buffer.from(await file.arrayBuffer());
    const tempDir = os.tmpdir();
    tempFilePath = path.join(tempDir, `upload-${Date.now()}.pdf`);
    await fs.writeFile(tempFilePath, buffer);

    // Call Python Script
    const scriptPath = path.join(process.cwd(), 'scripts', 'pdf_extractor.py');
    const { stdout, stderr } = await execAsync(`python "${scriptPath}" "${tempFilePath}"`);

    if (stderr) {
      console.warn("Python Extractor Warning:", stderr);
    }

    try {
      const result = JSON.parse(stdout);
      if (result.success && result.text) {
        console.log(`Extracted via ${result.strategy}: ${result.text.length} characters`);
        return NextResponse.json({ text: result.text.trim() });
      } else {
        throw new Error(result.error || "Unknown extraction error");
      }
    } catch (parseError) {
      console.error("Failed to parse Python output:", stdout);
      throw parseError;
    }

  } catch (error) {
    console.error('PDF Parse Error:', error);
    return NextResponse.json({ 
      text: "", 
      error: 'Failed to process PDF',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  } finally {
    if (tempFilePath) {
      try {
        await fs.unlink(tempFilePath);
      } catch (cleanupError) {
        console.error('Failed to clean up temp file:', cleanupError);
      }
    }
  }
}
