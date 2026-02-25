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
  // We want Name, Position, Email, Phone to be FIRST in the list
  const priorityOrder = ['candidate_name', 'current_position', 'contact_email', 'contact_phone'];
  
  priorityOrder.forEach(key => {
    if (advancedData.fields[key]) {
      const displayLabel = key.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      fields.push({
        label: displayLabel,
        value: advancedData.fields[key].value,
        confidence: advancedData.fields[key].confidence
      });
      delete advancedData.fields[key];
    }
  });

  // Add Remaining Dynamic Fields
  Object.entries(advancedData.fields).forEach(([label, data]) => {
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

  // --- 2. Identity Extraction (Resume Specific - Top of Doc) ---
  if (result.document_type === "Resume") {
    // 2.a Candidate Name: Usually the first non-empty line
    if (lines.length > 0) {
      const nameCandidate = lines[0].replace(/[|•]/g, '').trim();
      if (nameCandidate.length > 3 && nameCandidate.split(' ').length <= 4) {
        result.fields['candidate_name'] = { value: nameCandidate, confidence: 0.95 };
      }
    }

    // 2.b Current Position / Headline: Usually the second or third line
    for (let i = 1; i < Math.min(lines.length, 4); i++) {
      const line = lines[i];
      if (/Developer|Engineer|Manager|Lead|Analyst|Consultant/i.test(line)) {
        result.fields['current_position'] = { value: line.replace(/[|•]/g, '').trim(), confidence: 0.90 };
        break;
      }
    }

    // 2.c Contact Info (Email & Phone) - Using global scan but prioritizing top
    const emailMatch = text.match(/[a-zA-Z0-9+_.-]+@[a-zA-Z0-9.-]+\.[a-zA-z0-9]{2,}/i);
    if (emailMatch) result.fields['contact_email'] = { value: emailMatch[0], confidence: 0.99 };
    
    const phoneMatch = text.match(/[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}/);
    if (phoneMatch) result.fields['contact_phone'] = { value: phoneMatch[0], confidence: 0.98 };
  }

  // --- 3. Dynamic Field Detection (Smart Filtering) ---
  const kvRegex = /^\s*([^:\n]{2,40}):\s*(.+)$/gm;
  let match;
  
  const junkLabels = [
    'cid', 'page', 'date', 'frontend', 'background', 'http', 'https', 'www', 
    'unknown', 'na', 'n/a', 'undefined', 'null'
  ];

  while ((match = kvRegex.exec(text)) !== null) {
    const rawLabel = match[1].trim();
    const value = match[2].trim();
    
    const cleanLabel = rawLabel.replace(/^[^a-zA-Z]+/, '').trim();
    const labelKey = cleanLabel.toLowerCase().replace(/\s+/g, '_');

    if (
      cleanLabel.length > 2 && 
      !junkLabels.some(j => labelKey.includes(j)) &&
      value.length > 0 && 
      value.length < 300 &&
      !/^\d+$/.test(cleanLabel) &&
      !result.fields[labelKey] // Don't overwrite identity fields
    ) {
      result.fields[labelKey] = { value, confidence: 0.95 };
    }
  }

  // --- 4. Table Detection ---
  result.tables = detectAndExtractTables(lines);

  // --- 5. Content Section Detection ---
  let currentHeader = result.document_type === "Generic" ? "Extracted Information" : "Document Overview";
  let currentBlock: string[] = [];

  for (const line of lines) {
    const isLikelyHeader = /^[A-Z\s&]{3,40}$/.test(line) || 
                          (/^(\d+[\.\s]*)?[A-Z][a-z\s]{3,30}$/.test(line) && line.split(' ').length < 5);
    
    if (isLikelyHeader && !line.includes(':')) {
      if (currentBlock.length > 5) {
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
