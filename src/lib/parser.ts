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
 * Advanced Document Parsing Engine
 * Objective: Extract ALL fields, columns, and values dynamically.
 */
export const classifyAndParse = async (text: string, fileName: string): Promise<ParsedData> => {
  const safeText = text || "";
  const lowercaseText = safeText.toLowerCase();
  
  // 1. Structure Detection & Extraction
  const advancedData = extractEverything(safeText, fileName);
  
  // 2. Map back to UI-friendly structure
  const fields: ParsedField[] = [];
  
  // Add Dynamic Fields
  Object.entries(advancedData.fields).forEach(([label, data]) => {
    fields.push({
      label: label.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
      value: data.value,
      confidence: data.confidence
    });
  });

  // Flatten Tables into the UI fields list for visibility (since UI holds a flat list)
  advancedData.tables.forEach(table => {
    const tableValue = table.rows.map(row => 
      Object.entries(row).map(([k, v]) => `${k}: ${v}`).join(' | ')
    ).join('\n---\n');
    
    fields.push({
      label: `Table: ${table.table_name || 'Data Grid'}`,
      value: tableValue,
      confidence: 0.90
    });
  });

  // Add Raw Sections
  if (advancedData.raw_sections.length > 0) {
    fields.push({
      label: 'Document Sections',
      value: advancedData.raw_sections.join('\n\n'),
      confidence: 0.85
    });
  }

  return { 
    type: advancedData.document_type as any, 
    fields: fields 
  };
};

function extractEverything(text: string, fileName: string): AdvancedParsedData {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  const result: AdvancedParsedData = {
    document_type: "Generic",
    fields: {},
    tables: [],
    raw_sections: [],
    csv_ready: [],
    confidence_score: 0.70
  };

  // --- 1. Document Type Detection ---
  if (/invoice|bill to|total amount|tax invoice/i.test(text)) result.document_type = "Invoice";
  else if (/experience|education|skills|resume|cv/i.test(text)) result.document_type = "Resume";
  else if (/agreement|contract|this lease|hereby|party of the first part/i.test(text)) result.document_type = "Legal";

  // --- 2. Key-Value Extraction (Dynamic Field Detection) ---
  // Matches patterns like "Label: Value" or "Label ... Value"
  const kvRegex = /^([^:\n]{2,30}):\s*(.+)$/gm;
  let match;
  while ((match = kvRegex.exec(text)) !== null) {
    const label = match[1].toLowerCase().replace(/\s+/g, '_');
    const value = match[2].trim();
    if (value.length > 0 && value.length < 200) {
      result.fields[label] = { value, confidence: 0.95 };
    }
  }

  // --- 3. Table Extraction (Heuristic Logic) ---
  // Looking for tab-separated or multiple spaces patterns
  const tableData = detectAndExtractTables(lines);
  result.tables = tableData;

  // --- 4. Section Detection ---
  let currentSection = "";
  let currentContent: string[] = [];
  
  for (const line of lines) {
    if (line.toUpperCase() === line && line.length > 3 && line.length < 50) {
      if (currentSection) result.raw_sections.push(`${currentSection}\n${currentContent.join('\n')}`);
      currentSection = line;
      currentContent = [];
    } else {
      currentContent.push(line);
    }
  }
  if (currentSection) result.raw_sections.push(`${currentSection}\n${currentContent.join('\n')}`);

  // --- 5. Normalization ---
  Object.keys(result.fields).forEach(key => {
    let val = result.fields[key].value;
    
    // Date Normalization (Attempt)
    if (val.match(/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/)) {
      // Basic conversion helper
      try {
        const d = new Date(val);
        if (!isNaN(d.getTime())) result.fields[key].value = d.toISOString().split('T')[0];
      } catch (e) {}
    }
  });

  return result;
}

function detectAndExtractTables(lines: string[]): TableData[] {
  const tables: TableData[] = [];
  let inTable = false;
  let currentTable: TableData | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // A table line usually has multiple column identifiers separated by significant spacing or delimiters
    const parts = line.split(/\s{2,}|\t/).filter(p => p.length > 0);
    
    if (parts.length >= 3) {
      if (!inTable) {
        inTable = true;
        currentTable = {
          table_name: `Table_${tables.length + 1}`,
          columns: parts.map(p => p.toLowerCase().replace(/\s+/g, '_')),
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
      if (inTable && currentTable) {
        tables.push(currentTable);
        inTable = false;
        currentTable = null;
      }
    }
  }
  if (currentTable) tables.push(currentTable);
  
  return tables;
}
