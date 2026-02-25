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
 * Advanced Document Parsing Engine (Zero-Loss Edition)
 * Objective: 100% Information extraction. No data left behind.
 */
export const classifyAndParse = async (text: string, fileName: string): Promise<ParsedData> => {
  // --- 1. Noise Sanitization (Selective) ---
  // We keep more text now to ensure zero loss, but still strip binary artifacts
  const sanitizedText = (text || "")
    .replace(/\(cid:\d+\)/g, ' ') 
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, ' ');

  const lines = sanitizedText.split('\n').map(l => l.trim());
  
  // --- 2. Exhaustive Intelligent Extraction ---
  const advancedData = extractEverythingZeroLoss(sanitizedText, lines, fileName);
  
  // --- 3. Map to UI (Ensuring Fullness) ---
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

  // All Other Key-Value Fields
  Object.entries(advancedData.fields).forEach(([label, data]) => {
    fields.push({
      label: label.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
      value: data.value,
      confidence: data.confidence
    });
  });

  // All Tables
  advancedData.tables.forEach(table => {
    const tableValue = table.rows.map(row => 
      Object.entries(row).map(([k, v]) => `${k}: ${v}`).join(' | ')
    ).join('\n---\n');
    
    fields.push({
      label: `Structured Table: ${table.table_name}`,
      value: tableValue,
      confidence: 0.95
    });
  });

  // All Sections (The Catch-All for narrative text)
  advancedData.raw_sections.forEach(section => {
    const parts = section.split('\n');
    const title = parts[0].trim();
    const content = parts.slice(1).join('\n').trim();
    
    if (content.length > 0) {
      fields.push({
        label: `Section: ${title}`,
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

function extractEverythingZeroLoss(text: string, lines: string[], fileName: string): AdvancedParsedData {
  const result: AdvancedParsedData = {
    document_type: "Generic",
    fields: {},
    tables: [],
    raw_sections: [],
    csv_ready: [],
    confidence_score: 0.70
  };

  // Track which lines are "consumed" by structured parsing
  const consumedLines = new Set<number>();

  // --- 1. Type Detection ---
  if (/invoice|bill to|total amount|tax invoice/i.test(text)) result.document_type = "Invoice";
  else if (/experience|education|skills|resume|cv/i.test(text)) result.document_type = "Resume";
  else if (/agreement|contract|this lease|hereby/i.test(text)) result.document_type = "Legal";

  // --- 2. Identity & Global Patterns ---
  if (result.document_type === "Resume") {
    // Name Heuristic
    for (let i = 0; i < Math.min(lines.length, 5); i++) {
       if (lines[i].length > 3 && lines[i].split(' ').length <= 4 && !lines[i].includes(':')) {
         result.fields['candidate_name'] = { value: lines[i], confidence: 0.95 };
         consumedLines.add(i);
         break;
       }
    }
    // Professional Title
    for (let i = 0; i < Math.min(lines.length, 8); i++) {
      if (consumedLines.has(i)) continue;
      if (/Developer|Engineer|Manager|Lead|Analyst|Consultant|Designer|Architect/i.test(lines[i])) {
        result.fields['current_position'] = { value: lines[i], confidence: 0.90 };
        consumedLines.add(i);
        break;
      }
    }
  }

  // Global Regex Entities (Email/Phone)
  const emailRegex = /[a-zA-Z0-9+_.-]+@[a-zA-Z0-9.-]+\.[a-zA-z0-9]{2,}/gi;
  let emailMatch;
  while ((emailMatch = emailRegex.exec(text)) !== null) {
      result.fields[`email_${Object.keys(result.fields).filter(k => k.startsWith('email')).length + 1}`] = { value: emailMatch[0], confidence: 0.99 };
  }

  const phoneRegex = /[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}/g;
  let phoneMatch;
  while ((phoneMatch = phoneRegex.exec(text)) !== null) {
      result.fields[`phone_${Object.keys(result.fields).filter(k => k.startsWith('phone')).length + 1}`] = { value: phoneMatch[0], confidence: 0.98 };
  }

  // --- 3. Detailed Key-Value Extraction ---
  const kvRegex = /^\s*([^:\n]{2,50}):\s*(.+)$/gm;
  let kvMatch;
  while ((kvMatch = kvRegex.exec(text)) !== null) {
    const label = kvMatch[1].trim();
    const value = kvMatch[2].trim();
    const cleanLabel = label.replace(/[^\w\s]/g, '').toLowerCase().replace(/\s+/g, '_');
    
    if (cleanLabel.length > 1 && value.length > 0) {
      result.fields[cleanLabel] = { value, confidence: 0.95 };
      // Find which line this was to mark it as consumed
      lines.forEach((l, idx) => { if (l.includes(label) && l.includes(value)) consumedLines.add(idx); });
    }
  }

  // --- 4. Table Extraction ---
  // Tables consume lines entirely
  result.tables = detectTablesAndMarkLines(lines, consumedLines);

  // --- 5. Segmented Text Capture (Zero Loss Sections) ---
  // Every line not consumed yet MUST go into a section
  let currentHeader = "General Information";
  let currentBlock: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (consumedLines.has(i) || line.trim() === "") continue;

    // Detect if this line looks like a header (Uppercase, short)
    const isHeader = /^[A-Z\s&]{3,50}$/.test(line) || /^(\d+[\.\s]*)?[A-Z][a-z\s]{3,30}$/.test(line);
    
    if (isHeader && line.length < 60) {
      if (currentBlock.length > 0) {
        result.raw_sections.push(`${currentHeader}\n${currentBlock.join('\n')}`);
      }
      currentHeader = line;
      currentBlock = [];
    } else {
      currentBlock.push(line);
    }
  }
  // FINAL CATCH: Any remaining block
  if (currentBlock.length > 0) {
    result.raw_sections.push(`${currentHeader}\n${currentBlock.join('\n')}`);
  }

  return result;
}

function detectTablesAndMarkLines(lines: string[], consumed: Set<number>): TableData[] {
  const tables: TableData[] = [];
  let inTable = false;
  let currentTable: TableData | null = null;
  let startIdx = -1;

  for (let i = 0; i < lines.length; i++) {
    if (consumed.has(i)) continue;
    
    const line = lines[i];
    const parts = line.split(/\s{2,}|\t|\|/).filter(p => p.trim().length > 0);
    
    if (parts.length >= 3) {
      if (!inTable) {
        inTable = true;
        startIdx = i;
        currentTable = {
          table_name: `Data Grid ${tables.length + 1}`,
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
