# PRO Document Parser

## Overview
This project is a full-stack document parser built with Next.js, supporting both digital and scanned PDFs, as well as images. It extracts structured data from documents using a combination of JS and Python backends, and a robust OCR pipeline for image-based content.

## Features
- Upload and parse PDFs and images
- Extract structured fields, tables, and unmapped data
- Automatic fallback to OCR for scanned/image-based PDFs
- Export parsed data as JSON or CSV
- Visual dashboard: Graphical entry point for uploading and processing documents, with real-time status and analytics.
- Document gallery: Browse, search, and manage all parsed and saved documents in a dedicated repository. Easily select, preview, and delete documents. Access document details and rehydrate saved files for further review or export.

## Requirements
- Node.js (v18+ recommended)
- Python 3 (for advanced PDF extraction)
- npm (or yarn/pnpm)
- Tesseract.js (included in dependencies)
- pdfjs-dist (included in dependencies)
- Python packages: pdfplumber, pymupdf, pdf2image, pytesseract

## Setup
1. Clone the repository
2. Run `npm install` to install dependencies
3. Ensure Python is installed and required packages are available
4. Start the development server with `npm run dev`
5. Access the app at [http://localhost:3001](http://localhost:3001)

## API Endpoints
- `/api/parse-pdf` (POST): Upload a PDF file and receive extracted text
	- Request: FormData with `file` (PDF)
	- Response: `{ text: string }` (extracted text)
- Frontend automatically handles OCR fallback for scanned PDFs

## Project Structure
- `src/app/page.tsx`: Main UI logic and file upload handler
- `src/app/api/parse-pdf/route.ts`: PDF extraction API (JS and Python)
- `src/lib/ocr.ts`: OCR pipeline for images and scanned PDFs
- `src/lib/pdfToImages.ts`: PDF-to-image conversion for client-side OCR fallback
- `src/components/`: UI components (DataEditor, DocumentViewer, etc.)
- `scripts/pdf_extractor.py`: Python backend for advanced PDF extraction



## Example Usage
1. Upload a PDF or image
2. View parsed fields and unmapped data in the UI
3. Export results as JSON or CSV

## License
MIT
This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
