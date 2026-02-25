"use client";

import React from 'react';
import { Edit3, Check, AlertCircle, Save, Download, Trash2, FileJson, FileSpreadsheet } from 'lucide-react';
import Papa from 'papaparse';

interface ParsedField {
  label: string;
  value: string;
  confidence: number;
}

interface DataEditorProps {
  docType: string | null;
  fields: ParsedField[];
  onFieldChange: (index: number, newValue: string) => void;
  isProcessing: boolean;
  onSave?: () => void;
}

export const DataEditor: React.FC<DataEditorProps> = ({ docType, fields, onFieldChange, isProcessing, onSave }) => {
  const exportAsJSON = () => {
    // Advanced structuring for complex fields
    const structuredFields: Record<string, any> = {};
    
    fields.forEach(field => {
      const key = field.label;
      const val = field.value.trim();
      
      // Attempt to structure multi-line string text fields (like Skills, Projects, Experience) into arrays
      if (val.includes('\n') || ['Skills', 'Experience', 'Education', 'Projects'].includes(key)) {
         structuredFields[key] = val.split('\n').map(item => item.trim()).filter(Boolean);
      } else {
         structuredFields[key] = val;
      }
    });

    const data = {
      metadata: {
        documentClass: docType,
        extractedAt: new Date().toISOString(),
        totalFieldsFound: fields.length
      },
      extractedData: structuredFields
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Document_Data_${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportAsCSV = () => {
    const csvData = fields.map(f => ({ Field: f.label, Value: f.value, Confidence: f.confidence }));
    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `parsed_data_${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };
  if (isProcessing) {
    return (
      <div className="flex flex-col space-y-4 p-6 bg-white/80 rounded-[16px] border border-slate-200 animate-pulse shadow-sm">
        <div className="h-4 w-1/4 bg-slate-200 rounded mb-6"></div>
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="space-y-2">
            <div className="h-3 w-1/3 bg-slate-100 rounded"></div>
            <div className="h-10 w-full bg-slate-50/80 rounded-xl"></div>
          </div>
        ))}
      </div>
    );
  }

  if (!fields.length) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[500px] rounded-[16px] bg-white/80 border border-slate-200 shadow-sm">
        <AlertCircle size={48} className="text-slate-300 mb-4" />
        <p className="text-slate-500 font-medium font-secondary text-center px-6">
          Upload a document to see structured data
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white/80 backdrop-blur-md rounded-[16px] border border-slate-200 shadow-sm">
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/80 rounded-t-[16px]">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-accent/10 rounded-[10px] text-accent">
            <Edit3 size={18} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800">Structured Data</h3>
            <p className="text-[10px] text-accent font-bold uppercase tracking-widest">{docType || 'Detected Type'}</p>
          </div>
        </div>
        <div className="flex space-x-2">
          <button 
            onClick={exportAsJSON}
            className="flex items-center space-x-1 px-3 py-1.5 bg-white text-slate-700 rounded-[6px] border border-slate-200 shadow-sm text-xs font-semibold hover:bg-slate-50 transition-colors"
          >
            <FileJson size={14} />
            <span>JSON</span>
          </button>
          <button 
            onClick={exportAsCSV}
            className="flex items-center space-x-1 px-3 py-1.5 bg-primary text-white rounded-[6px] text-xs font-semibold hover:bg-primary-dark transition-colors shadow-sm"
          >
            <FileSpreadsheet size={14} />
            <span>CSV</span>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-6 custom-scrollbar bg-slate-50/50 border-t border-slate-200">
        {fields.map((field, index) => (
          <div key={index} className="space-y-1.5 animate-in slide-in-from-right-4 duration-300" style={{ animationDelay: `${index * 50}ms` }}>
            <div className="flex items-center justify-between pointer-events-none">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider font-secondary">
                {field.label}
              </label>
              <div className="flex items-center space-x-1 group">
                <div className={`h-1.5 w-1.5 rounded-full ${field.confidence > 0.8 ? 'bg-success' : field.confidence > 0.5 ? 'bg-warning' : 'bg-error'}`} />
                <span className="text-[10px] font-medium text-slate-400 italic">
                  {(field.confidence * 100).toFixed(0)}% Match
                </span>
              </div>
            </div>
            <div className="relative group">
              {field.value.length > 80 || field.label === 'Experience' || field.label === 'Education' || field.label === 'Projects' || field.label === 'Skills' ? (
                <textarea
                  value={field.value}
                  onChange={(e) => onFieldChange(index, e.target.value)}
                  className="w-full px-4 py-3 bg-white shadow-sm border border-slate-200 rounded-[10px] text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none min-h-[100px] resize-y custom-scrollbar"
                />
              ) : (
                <input
                  type="text"
                  value={field.value}
                  onChange={(e) => onFieldChange(index, e.target.value)}
                  className="w-full px-4 py-3 bg-white shadow-sm border border-slate-200 rounded-[10px] text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none"
                />
              )}
              <div className="absolute right-4 top-4 opacity-0 group-focus-within:opacity-100 transition-opacity pointer-events-none">
                <div className="p-1 bg-primary rounded-md text-white shadow-md">
                  <Save size={12} />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      <div className="p-6 bg-slate-50/80 border-t border-slate-200 rounded-b-[16px]">
         <div className="flex items-center justify-between p-4 bg-white shadow-sm rounded-[10px] border border-primary/20">
            <div className="flex items-center space-x-3">
              <Check className="text-primary" size={20} />
              <div>
                <p className="text-xs font-bold text-slate-800">Final Verification</p>
                <p className="text-[10px] text-primary font-semibold">Ready for CRM synchronization</p>
              </div>
            </div>
            <button onClick={onSave} className="px-5 py-2.5 bg-primary text-white rounded-[10px] text-xs font-bold hover:bg-primary-dark transition-colors shadow-glow">
              Save Document
            </button>
         </div>
      </div>
    </div>
  );
};
