"use client";

import React, { useEffect, useState } from 'react';
import { FileText, Clock, Trash2, Database } from 'lucide-react';
import { getAllDocuments, SavedDocument, deleteDocument } from '@/lib/storage';

interface DocumentGalleryProps {
  onSelectDocument: (doc: SavedDocument) => void;
}

export const DocumentGallery: React.FC<DocumentGalleryProps> = ({ onSelectDocument }) => {
  const [docs, setDocs] = useState<SavedDocument[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDocs();
  }, []);

  const loadDocs = async () => {
    setLoading(true);
    const loadedDocs = await getAllDocuments();
    setDocs(loadedDocs);
    setLoading(false);
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to permanently delete this document from local storage?')) {
      await deleteDocument(id);
      loadDocs();
    }
  };

  if (loading) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <Database className="animate-pulse text-primary/50" size={40} />
          <p className="text-sm font-medium text-slate-500">Loading saved cases...</p>
        </div>
      </div>
    );
  }

  if (docs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-4 animate-fade-in bg-white/40 rounded-3xl border border-dashed border-slate-300 m-8">
        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center">
          <FileText size={24} className="text-slate-400" />
        </div>
        <div className="text-center space-y-1">
          <p className="text-lg font-bold text-slate-700">No Documents Saved</p>
          <p className="text-sm font-medium text-slate-500 font-secondary">Parsed documents will appear here once saved.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-8 custom-scrollbar">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Document Repository</h2>
          <p className="text-sm text-slate-500 font-secondary mt-1">Locally stored parsed intelligence</p>
        </div>
        <div className="px-3 py-1 bg-primary/10 text-primary rounded-full border border-primary/20 text-xs font-bold">
          {docs.length} Saved
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {docs.map((doc, index) => (
          <div 
            key={doc.id}
            onClick={() => onSelectDocument(doc)}
            className="group bg-white rounded-2xl border border-slate-200 p-6 cursor-pointer hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] hover:border-primary/30 transition-all duration-300 relative flex flex-col h-[200px] animate-fade-in"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-primary-dark opacity-0 group-hover:opacity-100 transition-opacity rounded-t-2xl" />
            
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-slate-50 group-hover:bg-primary/5 text-slate-500 group-hover:text-primary transition-colors rounded-xl border border-slate-100 group-hover:border-primary/10">
                <FileText size={24} />
              </div>
              <button 
                onClick={(e) => handleDelete(e, doc.id)}
                className="text-slate-300 hover:text-error transition-colors p-2 hover:bg-error/10 rounded-lg opacity-0 group-hover:opacity-100"
              >
                <Trash2 size={16} />
              </button>
            </div>
            
            <h3 className="text-sm font-bold text-slate-800 line-clamp-2 mb-2 group-hover:text-primary transition-colors">{doc.name}</h3>
            
            <div className="mt-auto">
              <div className="flex items-center space-x-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-3">
                <span className="text-primary bg-primary/10 px-2 py-0.5 rounded">{doc.type}</span>
                <span>•</span>
                <span>{doc.fields.length} Data Points</span>
              </div>
              
              <div className="flex items-center space-x-1.5 text-[11px] text-slate-400 font-medium">
                <Clock size={12} />
                <span>{new Date(doc.dateAdded).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
