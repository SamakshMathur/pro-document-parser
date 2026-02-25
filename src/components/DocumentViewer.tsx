"use client";

import React from 'react';
import { Eye, FileText, Download, ZoomIn, ZoomOut, RotateCw } from 'lucide-react';

interface DocumentViewerProps {
  file: File | null;
  fileUrl: string | null;
}

export const DocumentViewer: React.FC<DocumentViewerProps> = ({ file, fileUrl }) => {
  if (!file || !fileUrl) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[500px] rounded-[16px] bg-white/80 border border-slate-200 animate-pulse shadow-sm backdrop-blur-sm">
        <FileText size={48} className="text-slate-300 mb-4" />
        <p className="text-slate-500 font-medium font-secondary">No document selected</p>
      </div>
    );
  }

  const isImage = file.type.startsWith('image/');
  const isPdf = file.type === 'application/pdf';

  return (
    <div className="flex flex-col h-full bg-white/80 backdrop-blur-md rounded-[16px] border border-slate-200 overflow-hidden shadow-sm space-y-0">
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/80">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-primary/10 rounded-[10px] text-primary">
            <Eye size={18} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800 truncate max-w-[150px]">
              {file.name}
            </h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{file.type.split('/')[1]}</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
           <button className="p-2 hover:bg-slate-100 rounded-[10px] transition-colors text-slate-400 hover:text-slate-800">
            <ZoomOut size={18} />
          </button>
          <button className="p-2 hover:bg-slate-100 rounded-[10px] transition-colors text-slate-400 hover:text-slate-800">
            <ZoomIn size={18} />
          </button>
          <button className="p-2 hover:bg-slate-100 rounded-[10px] transition-colors text-slate-400 hover:text-slate-800">
            <RotateCw size={18} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 bg-slate-50/50 custom-scrollbar">
        <div className="flex justify-center min-h-full">
          {isImage ? (
            <img 
              src={fileUrl} 
              alt="Document Preview" 
              className="max-w-full h-auto object-contain rounded-lg shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-500 border border-slate-200"
            />
          ) : isPdf ? (
            <iframe
              src={`${fileUrl}#toolbar=0`}
              className="w-full h-full min-h-[600px] border border-slate-200 rounded-lg shadow-xl bg-white"
              title="PDF Preview"
            />
          ) : (
            <div className="flex flex-col items-center justify-center p-12 text-center">
              <FileText size={64} className="text-slate-300 mb-4" />
              <p className="text-slate-500 font-medium">Unpreviewable file format</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
