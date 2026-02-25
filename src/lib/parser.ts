export interface ParsedField {
  label: string;
  value: string;
  confidence: number;
}

export interface ParsedData {
  type: 'Resume' | 'Invoice' | 'Legal' | 'Generic';
  fields: ParsedField[];
  tables?: TableData[];
}

export interface TableData {
  table_name: string;
  columns: string[];
  rows: Record<string, any>[];
}

interface AdvancedParsedData {
  document_type: string;
  fields: Record<string, { value: string; confidence: number; source?: string }>;
  tables: TableData[];
  raw_sections: string[];
  csv_ready: any[];
  confidence_score: number;
}

// Semantic Anchors for Resume Parsing
const RESUME_ANCHORS = [
  'EDUCATION', 'EXPERIENCE', 'WORK EXPERIENCE', 'PROFESSIONAL EXPERIENCE', 
  'PROJECTS', 'SKILLS', 'TECHNICAL SKILLS', 'SUMMARY', 'PROFESSIONAL SUMMARY',
  'ACHIEVEMENTS', 'CERTIFICATIONS', 'LANGUAGES', 'INTERESTS', 'COURSES'
];

/**
 * Advanced Document Parsing Engine (Semantic Context Edition)
 * Objective: High-precision extraction with strict semantic boundaries.
 */
export const classifyAndParse = async (text: string, fileName: string): Promise<ParsedData> => {
  // --- 1. Noise Sanitization ---
  const sanitizedText = (text || "")
    .replace(/\(cid:\d+\)/g, ' ') 
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, ' ');

  const lines = sanitizedText.split('\n').map(l => l.trim());
  
  // --- 2. Exhaustive Intelligent Extraction ---
  const advancedData = extractEverythingContextual(sanitizedText, lines, fileName);
  
  // --- 3. Map to UI ---
  const fields: ParsedField[] = [];
  
  // Priority Identity Fields
  const priorityOrder = ['candidate_name', 'current_position', 'contact_email', 'contact_phone', 'invoice_number', 'total_amount'];
  priorityOrder.forEach(key => {
    if (advancedData.fields[key]) {
      fields.push({
        label: key.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
        value: advancedData.fields[key].value,
        confidence: advancedData.fields[key].confidence
      });
      delete advancedData.fields[key];
    }
  });

  // Dynamic Key-Value Pairs
  Object.entries(advancedData.fields).forEach(([label, data]) => {
    fields.push({
      label: label.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
      value: data.value,
      confidence: data.confidence
    });
  });

  // Table Data
  advancedData.tables.forEach(table => {
    const tableValue = table.rows.map(row => 
      Object.entries(row).map(([k, v]) => `${k}: ${v}`).join(' | ')
    ).join('\n---\n');
    
    fields.push({
      label: `Table: ${table.table_name}`,
      value: tableValue,
      confidence: 0.95
    });
  });

  // Semantic Sections (The heart of accuracy)
  advancedData.raw_sections.forEach(section => {
    const parts = section.split('\n');
    const title = parts[0].trim();
    const content = parts.slice(1).join('\n').trim();
    
    if (content.length > 0) {
      fields.push({
        label: title.length < 30 ? title : "Section Content",
        value: content,
        confidence: 0.90
      });
    }
  });

  return { 
    type: advancedData.document_type as any, 
    fields: fields 
  };
};

function extractEverythingContextual(text: string, lines: string[], fileName: string): AdvancedParsedData {
  const result: AdvancedParsedData = {
    document_type: "Generic",
    fields: {},
    tables: [],
    raw_sections: [],
    csv_ready: [],
    confidence_score: 0.70
  };

  const consumedLines = new Set<number>();
  const lowerText = text.toLowerCase();

  // --- 1. Enhanced Type Detection ---
  if (/invoice|bill to|bill from|total due|tax invoice/i.test(lowerText)) result.document_type = "Invoice";
  else if (/experience|education|skills|resume|curriculum vitae/i.test(lowerText)) result.document_type = "Resume";
  else if (/agreement|contract|this lease|hereby|parties/i.test(lowerText)) result.document_type = "Legal";

  // --- 2. Global Entity Extraction (Email, Phone, Links) ---
  const emailRegex = /[a-zA-Z0-9+_.-]+@[a-zA-Z0-9.-]+\.[a-zA-z0-9]{2,}/gi;
  (text.match(emailRegex) || []).forEach((email, idx) => {
    result.fields[`contact_email${idx > 0 ? `_${idx + 1}` : ''}`] = { value: email, confidence: 0.99 };
  });

  const phoneRegex = /[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}/g;
  (text.match(phoneRegex) || []).forEach((phone, idx) => {
    result.fields[`contact_phone${idx > 0 ? `_${idx + 1}` : ''}`] = { value: phone, confidence: 0.98 };
  });

  // --- 3. Semantic Sectioning (Anchors) ---
  const sections: { header: string; startIdx: number; endIdx: number }[] = [];
  
  // Pre-scan for anchors to define boundaries
  lines.forEach((line, idx) => {
    const normalized = line.toUpperCase().replace(/[^A-Z\s]/g, '').trim();
    if (RESUME_ANCHORS.includes(normalized) && line.length < 50) {
      if (sections.length > 0) sections[sections.length - 1].endIdx = idx;
      sections.push({ header: line, startIdx: idx, endIdx: lines.length });
    }
  });

  // If no anchors found for a Resume, fallback to basic blocks
  if (sections.length === 0 && result.document_type === "Resume") {
    sections.push({ header: "Candidate Profile", startIdx: 0, endIdx: lines.length });
  }

  // --- 4. Content Extraction within Sections ---
  sections.forEach((section, sIdx) => {
    const sectionLines = lines.slice(section.startIdx, section.endIdx);
    const sectionText = sectionLines.join('\n');
    let sectionResidual: string[] = [];

    // CONSUME HEADER
    consumedLines.add(section.startIdx);

    // Try Key-Value extraction within this section
    const sectionKvRegex = /^\s*([^:\n]{2,40}):\s*(.+)$/gm;
    let match;
    const caughtInThisSection = new Set<string>();

    while ((match = sectionKvRegex.exec(sectionText)) !== null) {
      const rawLabel = match[1].trim();
      const value = match[2].trim();
      const key = rawLabel.toLowerCase().replace(/\s+/g, '_').replace(/[^\w]/g, '');
      
      if (key.length > 1 && !caughtInThisSection.has(key)) {
        result.fields[key] = { value, confidence: 0.95 };
        caughtInThisSection.add(key);
        // Mark these lines as consumed
        sectionLines.forEach((l, lIdx) => {
          if (l.includes(rawLabel) && l.includes(value)) consumedLines.add(section.startIdx + lIdx);
        });
      }
    }

    // Capture everything else in this section as "narrative"
    sectionLines.forEach((l, lIdx) => {
      const globalIdx = section.startIdx + lIdx;
      if (!consumedLines.has(globalIdx) && l.trim().length > 0) {
        sectionResidual.push(l);
        consumedLines.add(globalIdx);
      }
    });

    if (sectionResidual.length > 0) {
      result.raw_sections.push(`${section.header}\n${sectionResidual.join('\n')}`);
    }
  });

  // --- 5. Absolute Catch-All (Unprocessed Lines) ---
  const finalResidual: string[] = [];
  lines.forEach((line, idx) => {
    if (!consumedLines.has(idx) && line.trim().length > 0) {
      finalResidual.push(line);
    }
  });

  if (finalResidual.length > 0) {
    result.raw_sections.push(`Additional Information\n${finalResidual.join('\n')}`);
  }

  // --- 6. Table Extraction (Specifically for Invoices) ---
  if (result.document_type === "Invoice") {
    result.tables = detectTablesAndMarkLines(lines, new Set()); // Tables are non-destructive in this pass
  }

  return result;
}

function detectTablesAndMarkLines(lines: string[], consumed: Set<number>): TableData[] {
  const tables: TableData[] = [];
  let inTable = false;
  let currentTable: TableData | null = null;

  for (let i = 0; i < lines.length; i++) {
    if (consumed.has(i)) continue;
    const line = lines[i];
    const parts = line.split(/\s{2,}|\t|\|/).filter(p => p.trim().length > 0);
    
    if (parts.length >= 3) {
      if (!inTable) {
        inTable = true;
        currentTable = {
          table_name: `Table ${tables.length + 1}`,
          columns: parts.map(p => p.trim()),
          rows: []
        };
      } else if (currentTable) {
        const row: Record<string, any> = {};
        currentTable.columns.forEach((col, idx) => {
          row[col] = parts[idx] || "";
        });
        currentTable.rows.push(row);
      }
      consumed.add(i);
    } else {
      if (inTable && currentTable && currentTable.rows.length > 0) {
        tables.push(currentTable);
        inTable = false;
        currentTable = null;
      }
    }
  }
  if (currentTable && currentTable.rows.length > 0) tables.push(currentTable);
  return tables;
}
