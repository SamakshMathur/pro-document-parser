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

  // --- 1. Type Detection ---
  const lowerText = text.toLowerCase();
  if (lowerText.includes('invoice') || lowerText.includes('bill to') || lowerText.includes('total amount')) result.document_type = "Invoice";
  else if (lowerText.includes('experience') || lowerText.includes('education') || lowerText.includes('skills')) result.document_type = "Resume";
  else if (lowerText.includes('agreement') || lowerText.includes('contract')) result.document_type = "Legal";

  // --- 2. Anchor Discovery & Sectioning (Resume Path) ---
  if (result.document_type === "Resume") {
    // Identity Extraction (Top of Doc)
    for (let i = 0; i < Math.min(lines.length, 5); i++) {
       if (lines[i].length > 3 && lines[i].split(' ').length <= 4 && !lines[i].includes(':')) {
         result.fields['candidate_name'] = { value: lines[i], confidence: 0.98 };
         consumedLines.add(i);
         break;
       }
    }
    
    // Email & Phone
    const emailMatch = text.match(/[a-zA-Z0-9+_.-]+@[a-zA-Z0-9.-]+\.[a-zA-z0-9]{2,}/i);
    if (emailMatch) result.fields['contact_email'] = { value: emailMatch[0], confidence: 0.99 };
    
    const phoneMatch = text.match(/[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}/);
    if (phoneMatch) result.fields['contact_phone'] = { value: phoneMatch[0], confidence: 0.98 };

    // Section Anchor Split
    let currentHeader = "Profile";
    let currentBlock: string[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      if (consumedLines.has(i)) continue;
      const line = lines[i];
      const normalizedLine = line.toUpperCase().replace(/[^A-Z\s]/g, '').trim();
      
      const isAnchor = RESUME_ANCHORS.includes(normalizedLine);
      
      if (isAnchor) {
        if (currentBlock.length > 0) {
          result.raw_sections.push(`${currentHeader}\n${currentBlock.join('\n')}`);
        }
        currentHeader = line;
        currentBlock = [];
        consumedLines.add(i);
      } else {
        currentBlock.push(line);
      }
    }
    if (currentBlock.length > 0) {
      result.raw_sections.push(`${currentHeader}\n${currentBlock.join('\n')}`);
    }
  } else {
    // --- 3. Generic/Invoice Path (Legacy Key-Value + Table) ---
    const kvRegex = /^\s*([^:\n]{2,40}):\s*(.+)$/gm;
    let kvMatch;
    while ((kvMatch = kvRegex.exec(text)) !== null) {
      const label = kvMatch[1].trim();
      const value = kvMatch[2].trim();
      const key = label.toLowerCase().replace(/\s+/g, '_');
      result.fields[key] = { value, confidence: 0.95 };
      lines.forEach((l, idx) => { if (l.includes(label) && l.includes(value)) consumedLines.add(idx); });
    }

    result.tables = detectTablesAndMarkLines(lines, consumedLines);
    
    // Capture remaining narrative
    let currentHeader = "Document Info";
    let currentBlock: string[] = [];
    for (let i = 0; i < lines.length; i++) {
        if (consumedLines.has(i) || lines[i].trim() === "") continue;
        currentBlock.push(lines[i]);
    }
    if (currentBlock.length > 0) result.raw_sections.push(`${currentHeader}\n${currentBlock.join('\n')}`);
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
