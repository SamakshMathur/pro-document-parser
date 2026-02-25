export interface ParsedField {
  label: string;
  value: string;
  confidence: number;
}

export interface ParsedData {
  type: 'Resume' | 'Invoice' | 'Generic';
  fields: ParsedField[];
}

// Layer 4: Validation Logic
const calculateConfidence = (field: string, value: string): number => {
  if (!value || value === 'N/A' || value === 'Unknown') return 0.1;
  
  const validators: Record<string, (v: string) => number> = {
    'Email': (v) => /[a-zA-Z0-9.\-_+]+@[a-zA-Z0-9.\-_]+\.[a-zA-Z]{2,}/.test(v) ? 0.99 : 0.4,
    'Phone': (v) => /^\+?[\d\s\-()]{10,}$/.test(v) ? 0.95 : 0.5,
    'Full Name': (v) => {
      const words = v.trim().split(/\s+/);
      return (words.length >= 2 && words.length <= 4) ? 0.92 : 0.6;
    },
    'Total Amount': (v) => /\d/.test(v) ? 0.90 : 0.3,
    'Vendor Name': (v) => v.length > 3 ? 0.85 : 0.4,
  };

  const validator = validators[field];
  return validator ? validator(value) : 0.7;
};

export const classifyAndParse = async (text: string, fileName: string): Promise<ParsedData> => {
  const safeText = text || "";
  const lowercaseText = safeText.toLowerCase();
  const lowercaseFileName = (fileName || "").toLowerCase();

  // Weighted Classification for metadata tagging
  let resumeScore = 0;
  let invoiceScore = 0;

  if (lowercaseText.includes('experience') || lowercaseText.includes('education') || lowercaseText.includes('skills')) resumeScore += 2;
  if (lowercaseFileName.includes('resume') || lowercaseFileName.includes('cv')) resumeScore += 3;
  if (lowercaseText.includes('invoice') || lowercaseText.includes('bill to') || lowercaseText.includes('total amount')) invoiceScore += 2;
  if (lowercaseFileName.includes('invoice')) invoiceScore += 3;

  let type: 'Resume' | 'Invoice' | 'Generic' = 'Generic';
  if (invoiceScore > resumeScore && invoiceScore > 0) type = 'Invoice';
  else if (resumeScore > 0) type = 'Resume';

  return { type, fields: extractDynamicFields(safeText, fileName, type) };
};

// Layer 5: Universal Complete Text Extraction (Dynamic Chunking)
function extractDynamicFields(text: string, fileName: string, type: 'Resume' | 'Invoice' | 'Generic'): ParsedField[] {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  const fields: ParsedField[] = [];
  let currentHeader = "Document Profile / Summary";
  let currentBlock: string[] = [];

  // Semantic Heuristics
  const isSentence = (str: string) => /[\.\?!;,]$/.test(str) || /\b(is|are|was|were|the|this|that|there|their|with|in|of|and)\b/i.test(str);

  const isLikelyHeader = (line: string) => {
    // Length constraints
    if (line.length > 50 || line.length < 3) return false;
    
    // A header usually isn't a long descriptive sentence
    if (isSentence(line)) return false;
    
    // Pure numbers aren't headers
    if (/^\d+$/.test(line.replace(/[^0-9]/g, ''))) return false;

    // Rule 1: Very strong signal if it's all UPPERCASE letters and reasonably short
    if (line === line.toUpperCase() && /[A-Z]/.test(line)) return true;

    // Rule 2: Title Casing
    const words = line.split(/\s+/);
    if (words.length > 0 && words.length <= 5) {
      const cappedWords = words.filter(w => /^[A-Z]/.test(w));
      if (cappedWords.length / words.length >= 0.6) return true;
    }

    // Rule 3: Exact Global Keyword Match
    const keywords = ['experience', 'education', 'skills', 'projects', 'certifications', 'summary', 'profile', 'about', 'invoice', 'bill to', 'ship to', 'total', 'contact', 'references', 'awards', 'languages', 'open-source'];
    if (keywords.some(kw => line.toLowerCase().includes(kw))) return true;

    return false;
  };

  for (const line of lines) {
    if (isLikelyHeader(line)) {
      if (currentBlock.length > 0) {
        fields.push({
          label: currentHeader,
          value: currentBlock.join('\n'),
          confidence: calculateConfidence(currentHeader, currentBlock.join('\n'))
        });
      }
      currentHeader = line;
      currentBlock = [];
    } else {
      currentBlock.push(line);
    }
  }

  // Push final leftover block
  if (currentBlock.length > 0) {
    fields.push({
      label: currentHeader,
      value: currentBlock.join('\n'),
      confidence: calculateConfidence(currentHeader, currentBlock.join('\n'))
    });
  }

  // Top-Level Structural Extraction (Emails, Phones, specific high-value items)
  const emailRegex = /[a-zA-Z0-9.\-_+]+@[a-zA-Z0-9.\-_]+\.[a-zA-Z]{2,}/gi;
  const emails = text.match(emailRegex) || [];
  const phoneRegex = /(\+?\d{1,3}[\s\-]?\(?\d{3,5}\)?[\s\-]?\d{3,4}[\s\-]?\d{4})/g;
  const phones = text.match(phoneRegex) || text.match(/\d{10,12}/g) || [];
  const linkRegex = /(?:https?:\/\/)?(?:www\.)?(github\.com|linkedin\.com|medium\.com)[^\s]*/gi;
  const links = text.match(linkRegex) || [];

  const topFields: ParsedField[] = [];

  if (type === 'Invoice') {
    const totalMatch = text.match(/(?:total|amount due|balance|payable|grand total):\s*[^\d]*([\d,]+\.?\d*)/i);
    if (totalMatch) topFields.push({ label: 'Total Amount', value: totalMatch[1].startsWith('$') ? totalMatch[1] : `$${totalMatch[1]}`, confidence: 0.95 });
  }

  if (emails.length > 0) topFields.push({ label: 'Identified Email(s)', value: [...new Set(emails)].join(', '), confidence: 0.99 });
  if (phones.length > 0) topFields.push({ label: 'Identified Phone', value: [...new Set(phones)].join(', '), confidence: 0.95 });
  if (links.length > 0) topFields.push({ label: 'Identified Links', value: [...new Set(links)].join(', '), confidence: 0.90 });

  // Filter out any blocks that ended up empty or purely whitespace
  const validDynamicFields = fields.filter(f => f.value.trim().length > 0);

  return [...topFields, ...validDynamicFields];
}
