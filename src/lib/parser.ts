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

/**
 * Advanced Document Parsing Engine (Smart Edition)
 * Objective: Extract ALL fields while filtering PDF noise and junk artifacts.
 */
export const classifyAndParse = async (text: string, fileName: string): Promise<ParsedData> => {
  // --- 1. Noise Sanitization (CRITICAL for PDFs) ---
  const sanitizedText = (text || "")
    .replace(/\(cid:\d+\)/g, '') // Remove (cid:30) style artifacts
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, ''); // Remove non-printable chars

  const lines = sanitizedText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  // --- 2. Intelligent Extraction ---
  const advancedData = extractEverythingSmart(sanitizedText, lines, fileName);
  
  // --- 3. Map back to UI-friendly structure ---
  const fields: ParsedField[] = [];
  
  // Add Identifiers / Metadata (Top Priority)
  Object.entries(advancedData.fields).forEach(([label, data]) => {
    // Label beautification
    const displayLabel = label.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    fields.push({
      label: displayLabel,
      value: data.value,
      confidence: data.confidence
    });
  });

  // Add Tables if they exist
  advancedData.tables.forEach(table => {
    const tableValue = table.rows.map(row => 
      Object.entries(row).map(([k, v]) => `${k}: ${v}`).join(' | ')
    ).join('\n---\n');
    
    fields.push({
      label: `Table: ${table.table_name}`,
      value: tableValue,
      confidence: 0.90
    });
  });

  // Add Logical Sections (Grouped Content)
  advancedData.raw_sections.forEach(section => {
    const parts = section.split('\n');
    const title = parts[0].trim();
    const content = parts.slice(1).join('\n').trim();
    
    if (content.length > 10) {
      fields.push({
        label: title.charAt(0).toUpperCase() + title.slice(1).toLowerCase(),
        value: content,
        confidence: 0.85
      });
    }
  });

  return { 
    type: advancedData.document_type as any, 
    fields: fields 
  };
};

function extractEverythingSmart(text: string, lines: string[], fileName: string): AdvancedParsedData {
  const result: AdvancedParsedData = {
    document_type: "Generic",
    fields: {},
    tables: [],
    raw_sections: [],
    csv_ready: [],
    confidence_score: 0.70
  };

  // --- 1. Document Type Detection (Priority Heuristic) ---
  if (/invoice|bill to|total amount|tax invoice/i.test(text)) result.document_type = "Invoice";
  else if (/experience|education|skills|resume|cv/i.test(text)) result.document_type = "Resume";
  else if (/agreement|contract|this lease|hereby|party/i.test(text)) result.document_type = "Legal";

  // --- 2. Dynamic Field Detection (Smart Filtering) ---
  const kvRegex = /^\s*([^:\n]{2,40}):\s*(.+)$/gm;
  let match;
  
  // Common Junk Patterns for labels
  const junkLabels = [
    'cid', 'page', 'date', 'frontend', 'background', 'http', 'https', 'www', 
    'unknown', 'na', 'n/a', 'undefined', 'null'
  ];

  while ((match = kvRegex.exec(text)) !== null) {
    const rawLabel = match[1].trim();
    const value = match[2].trim();
    
    // Smart Label Filter: 
    // - No leading digits/symbols
    // - No cid artifacts
    // - Not on the junk list
    // - Length > 2
    const cleanLabel = rawLabel.replace(/^[^a-zA-Z]+/, '').trim();
    const labelKey = cleanLabel.toLowerCase().replace(/\s+/g, '_');

    if (
      cleanLabel.length > 2 && 
      !junkLabels.some(j => labelKey.includes(j)) &&
      value.length > 0 && 
      value.length < 300 &&
      !/^\d+$/.test(cleanLabel) // Not just a number
    ) {
      result.fields[labelKey] = { value, confidence: 0.95 };
    }
  }

  // --- 3. Resume Specific Entities (Emails, Phones, Names) ---
  if (result.document_type === "Resume") {
    const emailMatch = text.match(/[a-zA-Z0-9.\-_+]+@[a-zA-Z0-9.\-_]+\.[a-zA-Z]{2,}/i);
    if (emailMatch) result.fields['contact_email'] = { value: emailMatch[0], confidence: 0.99 };
    
    const phoneMatch = text.match(/[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}/);
    if (phoneMatch) result.fields['contact_phone'] = { value: phoneMatch[0], confidence: 0.98 };
  }

  // --- 4. Table Detection ---
  result.tables = detectAndExtractTables(lines);

  // --- 5. Content Section Detection ---
  // A vertical scan for likely headers
  let currentHeader = result.document_type === "Generic" ? "Extracted Information" : "Document Overview";
  let currentBlock: string[] = [];

  for (const line of lines) {
    // A line is a header if it's Uppercase, short, and not a KV pair we already caught
    const isLikelyHeader = /^[A-Z\s&]{3,40}$/.test(line) || 
                          (/^(\d+[\.\s]*)?[A-Z][a-z\s]{3,30}$/.test(line) && line.split(' ').length < 5);
    
    if (isLikelyHeader && !line.includes(':')) {
      if (currentBlock.length > 5) { // Only push if there's meaningful content
        result.raw_sections.push(`${currentHeader}\n${currentBlock.join('\n')}`);
      }
      currentHeader = line;
      currentBlock = [];
    } else {
      currentBlock.push(line);
    }
  }
  if (currentBlock.length > 0) {
    result.raw_sections.push(`${currentHeader}\n${currentBlock.join('\n')}`);
  }

  return result;
}

function detectAndExtractTables(lines: string[]): TableData[] {
  const tables: TableData[] = [];
  let inTable = false;
  let currentTable: TableData | null = null;

  for (const line of lines) {
    const parts = line.split(/\s{2,}|\t|\|/).filter(p => p.trim().length > 0);
    
    if (parts.length >= 3) {
      if (!inTable) {
        inTable = true;
        currentTable = {
          table_name: `Data Grid ${tables.length + 1}`,
          columns: parts.map(p => p.trim().substring(0, 30)),
          rows: []
        };
      } else if (currentTable) {
        const row: Record<string, any> = {};
        currentTable.columns.forEach((col, idx) => {
          row[col] = parts[idx] || "";
        });
        currentTable.rows.push(row);
      }
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
