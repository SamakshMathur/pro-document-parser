"use client";

import React, { useState } from 'react';
import { Edit3, Check, AlertCircle, Save, Download, FileJson, FileSpreadsheet, AlertTriangle, ShieldCheck, Info, PlusCircle, Target } from 'lucide-react';
import Papa from 'papaparse';
import type { ParsedField, TableData, CoverageAudit, MasterParsedData } from '@/lib/parser';

interface DataEditorProps {
  docType: string | null;
  fields: ParsedField[];
  onFieldChange: (index: number, newValue: string) => void;
  isProcessing: boolean;
  onSave?: () => void;
  masterData?: MasterParsedData;
}

const ConfidenceBadge = ({ confidence }: { confidence: number }) => {
  const pct = Math.round(confidence * 100);
  const color = confidence > 0.85 ? 'bg-emerald-500' : confidence > 0.65 ? 'bg-amber-400' : 'bg-red-500';
  const text = confidence > 0.85 ? 'text-emerald-600' : confidence > 0.65 ? 'text-amber-600' : 'text-red-600';
  return (
    <div className="flex items-center space-x-1">
      <div className={`h-1.5 w-1.5 rounded-full ${color}`} />
      <span className={`text-[10px] font-semibold ${text}`}>{pct}%</span>
    </div>
  );
};

const FieldBorderColor = (confidence: number) => {
  if (confidence > 0.85) return 'border-emerald-200 focus-within:ring-emerald-200';
  if (confidence > 0.65) return 'border-amber-200 focus-within:ring-amber-200';
  return 'border-red-200 focus-within:ring-red-200';
};

const CoverageRing = ({ score }: { score: number }) => {
  const color = score > 85 ? '#10b981' : score > 65 ? '#f59e0b' : '#ef4444';
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  return (
    <div className="relative w-16 h-16 flex items-center justify-center">
      <svg width="64" height="64" className="-rotate-90">
        <circle cx="32" cy="32" r={radius} strokeWidth="6" stroke="#e2e8f0" fill="none" />
        <circle cx="32" cy="32" r={radius} strokeWidth="6" stroke={color} fill="none"
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.8s ease' }}
        />
      </svg>
      <span className="absolute text-xs font-black text-slate-800">{score}%</span>
    </div>
  );
};

export const DataEditor: React.FC<DataEditorProps> = ({
  docType, fields, onFieldChange, isProcessing, onSave, masterData
}) => {
  const [activeTab, setActiveTab] = useState<'structured' | 'unmapped'>('structured');
  const [localFields, setLocalFields] = useState<ParsedField[]>([]);
  const [newFieldLabel, setNewFieldLabel] = useState('');
  const [newFieldValue, setNewFieldValue] = useState('');
  const [showAddField, setShowAddField] = useState(false);

  // Sync incoming fields to local editable state
  React.useEffect(() => { setLocalFields(fields); }, [fields]);

  const structuredFields = localFields.filter(f => f.source !== 'unmapped');
  const unmappedFields = localFields.filter(f => f.source === 'unmapped');
  const coverage = masterData?.coverage;

  const exportAsJSON = () => {
    const data = {
      metadata: {
        documentClass: docType,
        extractedAt: new Date().toISOString(),
        coverage: coverage,
        totalFields: structuredFields.length,
        extractionStrategy: masterData?.strategy || 'unknown',
      },
      structured_data: Object.fromEntries(
        structuredFields.map(f => [
          f.label,
          f.value.includes('\n')
            ? f.value.split('\n').map(l => l.trim()).filter(Boolean)
            : f.value
        ])
      ),
      tables: masterData?.tables ?? [],
      unmapped_data: unmappedFields.map(f => ({ label: f.label, value: f.value })),
      raw_text: masterData?.raw_text ?? '',
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Document_Master_${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportAsCSV = () => {
    const csvData = localFields.map(f => ({
      Field: f.label, Value: f.value, Confidence: `${Math.round(f.confidence * 100)}%`, Source: f.source
    }));
    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `parsed_data_${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleAddField = () => {
    if (!newFieldLabel.trim()) return;
    const newF: ParsedField = { label: newFieldLabel.trim(), value: newFieldValue.trim(), confidence: 1.0, source: 'structured' };
    setLocalFields(prev => [...prev, newF]);
    setNewFieldLabel('');
    setNewFieldValue('');
    setShowAddField(false);
  };

  const promoteUnmapped = (field: ParsedField) => {
    setLocalFields(prev =>
      prev.map(f => f === field ? { ...f, source: 'structured' as const, confidence: 0.85 } : f)
    );
  };

  if (isProcessing) {
    return (
      <div className="flex flex-col space-y-4 p-6 bg-white/80 rounded-[16px] border border-slate-200 animate-pulse shadow-sm h-full">
        <div className="h-4 w-1/4 bg-slate-200 rounded mb-6" />
        {[1,2,3,4,5].map(i => (
          <div key={i} className="space-y-2">
            <div className="h-3 w-1/3 bg-slate-100 rounded" />
            <div className="h-10 w-full bg-slate-50/80 rounded-xl" />
          </div>
        ))}
      </div>
    );
  }

  if (!localFields.length) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[500px] rounded-[16px] bg-white/80 border border-slate-200 shadow-sm">
        <AlertCircle size={48} className="text-slate-300 mb-4" />
        <p className="text-slate-500 font-medium text-center px-6">Upload a document to see structured data</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white/80 backdrop-blur-md rounded-[16px] border border-slate-200 shadow-sm">
      
      {/* ---- Header ---- */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 bg-slate-50/80 rounded-t-[16px] flex-shrink-0">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-accent/10 rounded-[10px] text-accent"><Edit3 size={16} /></div>
          <div>
            <h3 className="text-sm font-bold text-slate-800">Structured Data Editor</h3>
            <p className="text-[10px] text-accent font-bold uppercase tracking-widest">{docType || 'Document'}</p>
          </div>
        </div>
        <div className="flex space-x-2">
          <button onClick={exportAsJSON} className="flex items-center space-x-1 px-3 py-1.5 bg-white text-slate-700 rounded-[6px] border border-slate-200 shadow-sm text-xs font-semibold hover:bg-slate-50 transition-colors">
            <FileJson size={12} /><span>JSON</span>
          </button>
          <button onClick={exportAsCSV} className="flex items-center space-x-1 px-3 py-1.5 bg-primary text-white rounded-[6px] text-xs font-semibold hover:opacity-90 transition-opacity shadow-sm">
            <FileSpreadsheet size={12} /><span>CSV</span>
          </button>
        </div>
      </div>

      {/* ---- Coverage Dashboard ---- */}
      {coverage && (
        <div className="px-5 py-3 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <CoverageRing score={coverage.coverage_score} />
              <div>
                <p className="text-xs font-black text-slate-800">Coverage Score</p>
                <p className="text-[10px] text-slate-400">{coverage.mapped_items} of {coverage.total_detected_items} items mapped</p>
                {coverage.unmapped_items > 0 && (
                  <p className="text-[10px] text-amber-500 font-semibold">{coverage.unmapped_items} item(s) in Unmapped panel →</p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="bg-emerald-50 rounded-lg px-3 py-1.5 border border-emerald-100">
                <p className="text-base font-black text-emerald-600">{structuredFields.length}</p>
                <p className="text-[9px] text-emerald-500 font-bold uppercase">Structured</p>
              </div>
              <div className="bg-amber-50 rounded-lg px-3 py-1.5 border border-amber-100">
                <p className="text-base font-black text-amber-600">{unmappedFields.length}</p>
                <p className="text-[9px] text-amber-500 font-bold uppercase">Unmapped</p>
              </div>
            </div>
          </div>
          {coverage.missing_suggestions.length > 0 && (
            <div className="mt-2 p-2 bg-blue-50 rounded-lg border border-blue-100 flex items-start space-x-2">
              <Info size={12} className="text-blue-400 mt-0.5 flex-shrink-0" />
              <div className="space-y-0.5">
                {coverage.missing_suggestions.map((s, i) => (
                  <p key={i} className="text-[10px] text-blue-600">{s}</p>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ---- TABS ---- */}
      <div className="flex border-b border-slate-200 flex-shrink-0">
        <button
          onClick={() => setActiveTab('structured')}
          className={`flex items-center space-x-1.5 px-5 py-2.5 text-xs font-bold transition-colors border-b-2 ${activeTab === 'structured' ? 'border-primary text-primary bg-primary/5' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
        >
          <ShieldCheck size={13} />
          <span>Structured Fields ({structuredFields.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('unmapped')}
          className={`flex items-center space-x-1.5 px-5 py-2.5 text-xs font-bold transition-colors border-b-2 ${activeTab === 'unmapped' ? 'border-amber-500 text-amber-600 bg-amber-50/60' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
        >
          <AlertTriangle size={13} />
          <span>Unmapped Data ({unmappedFields.length})</span>
          {unmappedFields.length > 0 && <span className="ml-1 px-1.5 py-0.5 bg-amber-500 text-white rounded-full text-[9px] font-black">{unmappedFields.length}</span>}
        </button>
      </div>

      {/* ---- FIELD PANELS ---- */}
      <div className="flex-1 overflow-auto custom-scrollbar bg-slate-50/50">

        {/* STRUCTURED FIELDS PANEL */}
        {activeTab === 'structured' && (
          <div className="p-5 space-y-4">
            {structuredFields.map((field, index) => {
              const globalIdx = localFields.findIndex(f => f === field);
              const isLong = field.value.length > 80 || field.value.includes('\n');
              return (
                <div key={index} className={`space-y-1.5 animate-in slide-in-from-right-4 duration-300`} style={{ animationDelay: `${index * 40}ms` }}>
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{field.label}</label>
                    <ConfidenceBadge confidence={field.confidence} />
                  </div>
                  <div className={`relative rounded-[10px] border-2 transition-all ${FieldBorderColor(field.confidence)} focus-within:ring-2`}>
                    {isLong ? (
                      <textarea
                        value={field.value}
                        onChange={e => onFieldChange(globalIdx, e.target.value)}
                        className="w-full px-4 py-3 bg-white rounded-[10px] text-sm text-slate-800 focus:outline-none min-h-[80px] resize-y"
                      />
                    ) : (
                      <input
                        type="text"
                        value={field.value}
                        onChange={e => onFieldChange(globalIdx, e.target.value)}
                        className="w-full px-4 py-3 bg-white rounded-[10px] text-sm text-slate-800 focus:outline-none"
                      />
                    )}
                  </div>
                </div>
              );
            })}

            {/* Add Custom Field */}
            {showAddField ? (
              <div className="border-2 border-dashed border-primary/40 rounded-[12px] p-4 space-y-3 bg-primary/5">
                <p className="text-xs font-bold text-primary">Add Custom Field</p>
                <input type="text" placeholder="Field label..." value={newFieldLabel} onChange={e => setNewFieldLabel(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-[8px] focus:outline-none focus:ring-2 focus:ring-primary" />
                <input type="text" placeholder="Value..." value={newFieldValue} onChange={e => setNewFieldValue(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-[8px] focus:outline-none focus:ring-2 focus:ring-primary" />
                <div className="flex space-x-2">
                  <button onClick={handleAddField} className="px-4 py-1.5 bg-primary text-white rounded-[8px] text-xs font-bold hover:opacity-90">Add</button>
                  <button onClick={() => setShowAddField(false)} className="px-4 py-1.5 bg-white text-slate-500 border border-slate-200 rounded-[8px] text-xs hover:bg-slate-50">Cancel</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setShowAddField(true)} className="w-full flex items-center justify-center space-x-2 py-3 border-2 border-dashed border-slate-300 rounded-[12px] text-slate-400 hover:border-primary hover:text-primary transition-colors text-xs font-bold">
                <PlusCircle size={14} /><span>Add Custom Field</span>
              </button>
            )}
          </div>
        )}

        {/* UNMAPPED DATA PANEL */}
        {activeTab === 'unmapped' && (
          <div className="p-5 space-y-4">
            {unmappedFields.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 space-y-3">
                <div className="p-4 bg-emerald-50 rounded-full"><Target size={28} className="text-emerald-500" /></div>
                <p className="text-sm font-bold text-slate-600">All data successfully mapped!</p>
                <p className="text-[11px] text-slate-400">No unmapped content found in this document.</p>
              </div>
            ) : (
              <>
                <div className="p-3 bg-amber-50 rounded-[10px] border border-amber-200 flex items-start space-x-2">
                  <AlertTriangle size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
                  <p className="text-[11px] text-amber-700 font-medium">These text blocks were captured but couldn&apos;t be categorized automatically. Review and promote them to structured fields using the button below each block.</p>
                </div>
                {unmappedFields.map((field, index) => {
                  const globalIdx = localFields.findIndex(f => f === field);
                  return (
                    <div key={index} className="border-2 border-amber-200 rounded-[12px] bg-amber-50/50 overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-2 bg-amber-100/60 border-b border-amber-200">
                        <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">{field.label}</span>
                        <ConfidenceBadge confidence={field.confidence} />
                      </div>
                      <div className="p-4">
                        <textarea
                          value={field.value}
                          onChange={e => onFieldChange(globalIdx, e.target.value)}
                          className="w-full text-xs text-slate-700 bg-transparent focus:outline-none min-h-[60px] resize-y"
                        />
                      </div>
                      <div className="px-4 pb-3">
                        <button
                          onClick={() => promoteUnmapped(field)}
                          className="flex items-center space-x-1 px-3 py-1 bg-amber-500 text-white rounded-[6px] text-[10px] font-bold hover:bg-amber-600 transition-colors"
                        >
                          <ShieldCheck size={10} /><span>Promote to Structured</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}
      </div>

      {/* ---- Footer ---- */}
      <div className="p-4 bg-slate-50/80 border-t border-slate-200 rounded-b-[16px] flex-shrink-0">
        <div className="flex items-center justify-between p-3 bg-white shadow-sm rounded-[10px] border border-primary/20">
          <div className="flex items-center space-x-3">
            <Check className="text-primary" size={18} />
            <div>
              <p className="text-xs font-bold text-slate-800">Final Verification</p>
              <p className="text-[10px] text-primary font-semibold">Ready for export and CRM sync</p>
            </div>
          </div>
          <button onClick={onSave} className="px-5 py-2 bg-primary text-white rounded-[10px] text-xs font-bold hover:opacity-90 transition-opacity shadow-sm">
            Save Document
          </button>
        </div>
      </div>
    </div>
  );
};
