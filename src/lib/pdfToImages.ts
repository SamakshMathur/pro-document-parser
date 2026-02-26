export const pdfToImages = async (pdfFile: File): Promise<File[]> => {
  // Use pdfjs-dist to render PDF pages to canvas and export as PNG
  const pdfjsLib = await import('pdfjs-dist/build/pdf');
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/node_modules/pdfjs-dist/build/pdf.worker.js';

  const arrayBuffer = await pdfFile.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const images: File[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    await page.render({ canvasContext: ctx!, viewport }).promise;
    const dataUrl = canvas.toDataURL('image/png');
    // Convert dataURL to File
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    images.push(new File([blob], `page-${i}.png`, { type: 'image/png' }));
  }
  return images;
};