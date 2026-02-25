import { get, set, del, keys } from 'idb-keyval';
import { v4 as uuidv4 } from 'uuid';

export interface SavedDocument {
  id: string;
  name: string;
  type: string; // Classification (Invoice, Resume, etc)
  dateAdded: number;
  fields: any[];
  fileData: string; // Data URL (Base64)
  fileType: string;
}

export async function saveDocument(file: File, docType: string, fields: any[]): Promise<string> {
  const id = uuidv4();
  
  // Convert File to Base64 data URL for reliable IndexedDB storage
  const fileData = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const doc: SavedDocument = {
    id,
    name: file.name,
    type: docType,
    dateAdded: Date.now(),
    fields,
    fileData,
    fileType: file.type
  };

  await set(`doc_${id}`, doc);
  return id;
}

export async function getAllDocuments(): Promise<SavedDocument[]> {
  try {
    const allKeys = await keys();
    const docKeys = allKeys.filter(k => typeof k === 'string' && k.startsWith('doc_'));
    const docs = await Promise.all(docKeys.map(async k => {
        try { return await get(k); } catch(e) { return null; }
    }));
    return (docs.filter(Boolean) as SavedDocument[]).sort((a, b) => b.dateAdded - a.dateAdded);
  } catch (error) {
    console.error("Failed to load documents from IndexedDB:", error);
    return [];
  }
}

export async function getDocument(id: string): Promise<SavedDocument | undefined> {
  return get(`doc_${id}`);
}

export async function deleteDocument(id: string): Promise<void> {
  await del(`doc_${id}`);
}
