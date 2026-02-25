// ============================================================
// PRO Document Parser — Master Parsing Engine
// Strategy: Dual-Pass Pipeline + Coverage Auditor + Hybrid Storage
// ============================================================

// ---- Core Interfaces ----

export interface ParsedField {
  label: string;
  value: string;
  confidence: number;
  source: 'structured' | 'table' | 'section' | 'unmapped';
}

export interface TableData {
  table_name: string;
  columns: string[];
  rows: Record<string, any>[];
}

export interface CoverageAudit {
  coverage_score: number;          // 0–100
  total_detected_items: number;
  mapped_items: number;
  unmapped_items: number;
  missing_suggestions: string[];
}

export interface MasterParsedData {
  document_type: 'Resume' | 'Invoice' | 'Legal' | 'Generic';
  structured_data: ParsedField[];
  tables: TableData[];
  unmapped_data: ParsedField[];
  raw_text: string;
  coverage: CoverageAudit;
}

// Keep the legacy interface for backwards-compat with existing UI consumers
export interface ParsedData {
  type: 'Resume' | 'Invoice' | 'Legal' | 'Generic';
  fields: ParsedField[];
  tables?: TableData[];
  masterData?: MasterParsedData;
}

// ---- Semantic Anchors ----

const RESUME_ANCHORS: string[] = [
  'EDUCATION', 'EXPERIENCE', 'WORK EXPERIENCE', 'PROFESSIONAL EXPERIENCE',
  'PROJECTS', 'SKILLS', 'TECHNICAL SKILLS', 'SOFT SKILLS', 'CORE COMPETENCIES',
  'SUMMARY', 'PROFESSIONAL SUMMARY', 'OBJECTIVE', 'PROFILE',
  'ACHIEVEMENTS', 'CERTIFICATIONS', 'LICENSES', 'AWARDS',
  'LANGUAGES', 'INTERESTS', 'HOBBIES', 'VOLUNTEER', 'PUBLICATIONS',
  'REFERENCES', 'COURSES', 'TRAINING', 'ACTIVITIES',
];

const INVOICE_ANCHORS: string[] = [
  'BILL TO', 'SHIP TO', 'INVOICE DETAILS', 'PAYMENT DETAILS', 'LINE ITEMS',
  'SERVICES RENDERED', 'TERMS AND CONDITIONS', 'NOTES',
];

// ============================================================
// MAIN ENTRY POINT
// ============================================================
export const classifyAndParse = async (text: string, fileName: string): Promise<ParsedData> => {
  // Step 0: Sanitize
  const sanitizedText = (text || '')
    .replace(/\(cid:\d+\)/gi, ' ')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, ' ')
    .replace(/\s{3,}/g, '  ');

  const masterData = runMasterEngine(sanitizedText, fileName);

  // Flatten to legacy ParsedData.fields for existing UI compatibility
  const allFields: ParsedField[] = [
    ...masterData.structured_data,
    ...masterData.tables.map(t => ({
      label: `Table: ${t.table_name}`,
      value: t.rows
        .map(r => Object.entries(r).map(([k, v]) => `${k}: ${v}`).join(' | '))
        .join('\n---\n'),
      confidence: 0.95,
      source: 'table' as const,
    })),
    ...masterData.unmapped_data,
  ];

  return {
    type: masterData.document_type,
    fields: allFields,
    tables: masterData.tables,
    masterData,
  };
};

// ============================================================
// MASTER ENGINE
// ============================================================
function runMasterEngine(text: string, fileName: string): MasterParsedData {
  const lines = text.split('\n').map(l => l.trim());
  const consumedLines = new Set<number>();

  // ---------- 1. TYPE DETECTION ----------
  const lower = text.toLowerCase();
  let document_type: MasterParsedData['document_type'] = 'Generic';
  if (/invoice|bill to|bill from|total due|tax invoice/i.test(lower)) document_type = 'Invoice';
  else if (/experience|education|skills|resume|curriculum vitae/i.test(lower)) document_type = 'Resume';
  else if (/agreement|contract|this lease|hereby|parties/i.test(lower)) document_type = 'Legal';

  // ---------- 2. PASS 1 — STRUCTURED EXTRACTION ----------
  const structuredFields: ParsedField[] = [];
  const tables: TableData[] = [];

  // 2a. Global Entities (email, phone, URL, dates)
  extractGlobalEntities(text, structuredFields, lines, consumedLines);

  // 2b. Document-type-specific identity fields
  if (document_type === 'Resume') {
    extractResumeIdentity(lines, structuredFields, consumedLines);
  }

  // 2c. Section-Anchored extraction
  const anchors = document_type === 'Invoice' ? INVOICE_ANCHORS : RESUME_ANCHORS;
  extractAnchoredSections(lines, anchors, structuredFields, consumedLines);

  // 2d. Key-Value sweep across the whole document
  extractKeyValuePairs(text, lines, structuredFields, consumedLines);

  // 2e. Table detection
  extractTables(lines, tables, consumedLines);

  // ---------- 3. PASS 2 — RESIDUAL SWEEP (Catch-All) ----------
  const unmappedData: ParsedField[] = [];
  sweepResidual(lines, consumedLines, unmappedData);

  // ---------- 4. COVERAGE AUDITOR ----------
  const coverage = auditCoverage(lines, consumedLines, structuredFields, unmappedData);

  // ---------- 5. POST-PROCESSING ----------
  const dedupedStructured = deduplicateAndNormalize(structuredFields);

  return {
    document_type,
    structured_data: dedupedStructured,
    tables,
    unmapped_data: unmappedData,
    raw_text: text,
    coverage,
  };
}

// ============================================================
// PASS 1 HELPERS
// ============================================================

function extractGlobalEntities(
  text: string,
  fields: ParsedField[],
  lines: string[],
  consumed: Set<number>
) {
  const emailRegex = /[a-zA-Z0-9+_.-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;
  const emails = [...new Set(text.match(emailRegex) || [])];
  emails.forEach((email, i) => {
    fields.push({ label: i === 0 ? 'Email' : `Email ${i + 1}`, value: email, confidence: 0.99, source: 'structured' });
    markLineConsumed(lines, consumed, email);
  });

  const phoneRegex = /[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}/g;
  const phones = [...new Set(text.match(phoneRegex) || [])];
  phones.forEach((phone, i) => {
    fields.push({ label: i === 0 ? 'Phone' : `Phone ${i + 1}`, value: phone, confidence: 0.98, source: 'structured' });
    markLineConsumed(lines, consumed, phone);
  });

  const urlRegex = /https?:\/\/[^\s/$.?#].[^\s]*/gi;
  const urls = [...new Set(text.match(urlRegex) || [])];
  urls.forEach((url, i) => {
    fields.push({ label: i === 0 ? 'Website / Profile' : `Link ${i + 1}`, value: url, confidence: 0.97, source: 'structured' });
    markLineConsumed(lines, consumed, url);
  });
}

function extractResumeIdentity(lines: string[], fields: ParsedField[], consumed: Set<number>) {
  // Name: first short non-colon line in top 6 lines
  for (let i = 0; i < Math.min(lines.length, 6); i++) {
    if (!consumed.has(i) && lines[i].length > 2 && lines[i].split(' ').length <= 5 && !lines[i].includes(':') && !/\d{3}/.test(lines[i])) {
      fields.unshift({ label: 'Name', value: lines[i], confidence: 0.98, source: 'structured' });
      consumed.add(i);
      break;
    }
  }

  // Title/Role: common title keywords in next 8 lines
  const titleRx = /developer|engineer|manager|lead|analyst|consultant|designer|architect|director|officer|specialist/i;
  for (let i = 1; i < Math.min(lines.length, 8); i++) {
    if (!consumed.has(i) && titleRx.test(lines[i]) && lines[i].length < 80) {
      fields.push({ label: 'Current Position', value: lines[i], confidence: 0.95, source: 'structured' });
      consumed.add(i);
      break;
    }
  }
}

function extractAnchoredSections(
  lines: string[],
  anchors: string[],
  fields: ParsedField[],
  consumed: Set<number>
) {
  // Find all anchor positions
  const anchorPositions: { header: string; startIdx: number; endIdx: number }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const normalized = lines[i].toUpperCase().replace(/[^A-Z\s]/g, '').trim();
    const isAnchor = anchors.includes(normalized) && lines[i].length < 60;
    if (isAnchor) {
      if (anchorPositions.length > 0) anchorPositions[anchorPositions.length - 1].endIdx = i;
      anchorPositions.push({ header: lines[i], startIdx: i, endIdx: lines.length });
    }
  }

  // Extract content within each anchored section
  anchorPositions.forEach(section => {
    consumed.add(section.startIdx); // consume the anchor header line

    const sectionLines = lines.slice(section.startIdx + 1, section.endIdx);
    const sectionContent: string[] = [];

    sectionLines.forEach((line, relIdx) => {
      const globalIdx = section.startIdx + 1 + relIdx;
      if (!consumed.has(globalIdx) && line.trim().length > 0) {
        sectionContent.push(line);
        consumed.add(globalIdx);
      }
    });

    if (sectionContent.length > 0) {
      fields.push({
        label: section.header,
        value: sectionContent.join('\n'),
        confidence: 0.90,
        source: 'section',
      });
    }
  });
}

function extractKeyValuePairs(
  text: string,
  lines: string[],
  fields: ParsedField[],
  consumed: Set<number>
) {
  const kvRegex = /^[ \t]*([^:\n\d][^:\n]{1,45}):\s*(.+)$/gm;
  let match;
  const seenKeys = new Set<string>(fields.map(f => f.label.toLowerCase()));

  while ((match = kvRegex.exec(text)) !== null) {
    const rawLabel = match[1].trim();
    const value = match[2].trim();
    const normalizedKey = rawLabel.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();

    if (normalizedKey.length < 2 || seenKeys.has(normalizedKey)) continue;
    if (value.length === 0 || value.length > 300) continue;

    seenKeys.add(normalizedKey);
    fields.push({ label: rawLabel, value, confidence: 0.92, source: 'structured' });
    markLineConsumed(lines, consumed, rawLabel);
  }
}

function extractTables(lines: string[], tables: TableData[], consumed: Set<number>) {
  let inTable = false;
  let currentTable: TableData | null = null;

  for (let i = 0; i < lines.length; i++) {
    if (consumed.has(i)) continue;
    const parts = lines[i].split(/\s{2,}|\t|\|/).map(p => p.trim()).filter(p => p.length > 0);

    if (parts.length >= 3) {
      if (!inTable) {
        inTable = true;
        currentTable = { table_name: `Data Table ${tables.length + 1}`, columns: parts, rows: [] };
      } else if (currentTable) {
        const row: Record<string, any> = {};
        currentTable.columns.forEach((col, idx) => { row[col] = parts[idx] ?? ''; });
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
  if (inTable && currentTable && currentTable.rows.length > 0) tables.push(currentTable);
}

// ============================================================
// PASS 2 — RESIDUAL SWEEP
// ============================================================
function sweepResidual(lines: string[], consumed: Set<number>, unmapped: ParsedField[]) {
  let currentBlock: string[] = [];
  let currentLabel = 'Uncategorized Content';

  for (let i = 0; i < lines.length; i++) {
    if (consumed.has(i) || lines[i].trim() === '') continue;

    // Heuristic: this line looks like a new sub-header
    const isSubHeader = /^[A-Z][A-Za-z\s]{3,40}$/.test(lines[i]) && lines[i].length < 50;

    if (isSubHeader && currentBlock.length > 0) {
      unmapped.push({ label: currentLabel, value: currentBlock.join('\n'), confidence: 0.65, source: 'unmapped' });
      currentBlock = [];
      currentLabel = lines[i];
    } else {
      currentBlock.push(lines[i]);
    }
  }

  if (currentBlock.length > 0) {
    unmapped.push({ label: currentLabel, value: currentBlock.join('\n'), confidence: 0.65, source: 'unmapped' });
  }
}

// ============================================================
// COVERAGE AUDITOR
// ============================================================
function auditCoverage(
  lines: string[],
  consumed: Set<number>,
  structured: ParsedField[],
  unmapped: ParsedField[]
): CoverageAudit {
  const nonEmptyLines = lines.filter(l => l.trim().length > 0);
  const totalItems = nonEmptyLines.length;
  const mappedItems = consumed.size;
  const unmappedItems = totalItems - Math.min(mappedItems, totalItems);
  const coverageScore = totalItems > 0 ? Math.round((mappedItems / totalItems) * 100) : 100;

  // Generate suggestions for clearly missed data patterns
  const missing_suggestions: string[] = [];
  const fullText = lines.join('\n');
  if (!/name/i.test(structured.map(f => f.label).join(' ')) && /^[A-Z][a-z]+ [A-Z][a-z]+/m.test(fullText)) {
    missing_suggestions.push('A candidate name may not have been captured.');
  }
  if (unmapped.length > 0) {
    missing_suggestions.push(`${unmapped.length} block(s) of text could not be categorized. Review the "Unmapped Data" panel.`);
  }

  return {
    coverage_score: Math.min(coverageScore, 100),
    total_detected_items: totalItems,
    mapped_items: Math.min(mappedItems, totalItems),
    unmapped_items: unmappedItems,
    missing_suggestions,
  };
}

// ============================================================
// POST-PROCESSING
// ============================================================
function deduplicateAndNormalize(fields: ParsedField[]): ParsedField[] {
  const seen = new Map<string, ParsedField>();

  for (const field of fields) {
    const key = field.label.toLowerCase().replace(/\s+/g, ' ').trim();
    if (!seen.has(key)) {
      // Normalize dates
      const normalized = field.value.replace(
        /\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})\b/g,
        (_, d, m, y) => `${y.length === 2 ? '20' + y : y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
      );
      seen.set(key, { ...field, value: normalized });
    }
  }

  return Array.from(seen.values());
}

// ============================================================
// UTILITY HELPERS
// ============================================================
function markLineConsumed(lines: string[], consumed: Set<number>, text: string) {
  for (let i = 0; i < lines.length; i++) {
    if (!consumed.has(i) && lines[i].includes(text)) {
      consumed.add(i);
      break;
    }
  }
}
