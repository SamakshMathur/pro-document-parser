"use client";

import React, { useState, useEffect } from 'react';
import { Layout, BrainCircuit, History, Settings, Bell, Search, Layers, CheckCircle2 } from 'lucide-react';
import { FileUpload } from '@/components/FileUpload';
import { DocumentViewer } from '@/components/DocumentViewer';
import { DataEditor } from '@/components/DataEditor';
import { DocumentGallery } from '@/components/DocumentGallery';
import { VisualDashboard } from '@/components/VisualDashboard';
import { saveDocument, SavedDocument } from '@/lib/storage';
import type { MasterParsedData } from '@/lib/parser';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [docType, setDocType] = useState<string | null>(null);
  const [fields, setFields] = useState<any[]>([]);
  const [masterData, setMasterData] = useState<MasterParsedData | undefined>(undefined);
  const [currentView, setCurrentView] = useState<'dashboard' | 'documents' | 'documentDetail'>('dashboard');
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);

  const handleFileSelect = async (selectedFile: File) => {
    setFile(selectedFile);
    setIsProcessing(true);
    setCurrentView('documentDetail');
    setSelectedDocId(null);
    
    // Create preview URL
    const url = URL.createObjectURL(selectedFile);
    setFileUrl(url);

    try {
      let extractedText = "";

      if (selectedFile.type === 'application/pdf') {
        const formData = new FormData();
        formData.append('file', selectedFile);
        
        const response = await fetch('/api/parse-pdf', {
          method: 'POST',
          body: formData,
        });
        
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.details || data.error || 'PDF extraction failed');
        }

        extractedText = data.text || '';

        // If text is still empty, try OCR on PDF pages
        if (extractedText.trim().length < 20) {
          // Try client-side OCR as fallback
          const { pdfToImages } = await import('@/lib/pdfToImages');
          const { extractTextFromImage } = await import('@/lib/ocr');
          try {
            const images = await pdfToImages(selectedFile);
            let ocrText = '';
            for (const img of images) {
              ocrText += await extractTextFromImage(img) + '\n';
            }
            if (ocrText.trim().length > 20) {
              extractedText = ocrText;
            } else {
              setDocType('Generic');
              setFields([{
                label: '⚠️ Extraction Notice',
                value: data.error || 'This PDF appears to be image-based (scanned). Please export it as a JPG or PNG and upload the image version for OCR-based extraction.',
                confidence: 0,
                source: 'unmapped',
              }]);
              setIsProcessing(false);
              return;
            }
          } catch (ocrErr) {
            setDocType('Generic');
            setFields([{
              label: '⚠️ Extraction Notice',
              value: data.error || 'OCR failed. Please export PDF as image and upload.',
              confidence: 0,
              source: 'unmapped',
            }]);
            setIsProcessing(false);
            return;
          }
        }
      } else if (selectedFile.type.startsWith('image/')) {
        const { extractTextFromImage } = await import('@/lib/ocr');
        extractedText = await extractTextFromImage(selectedFile) || '';
      }

      const { classifyAndParse } = await import('@/lib/parser');
      const result = await classifyAndParse(extractedText, selectedFile.name);

      setDocType(result.type);
      setFields(result.fields);
      setMasterData(result.masterData);
    } catch (error) {
      console.error("Processing failed:", error);
      setDocType('Generic');
      setFields([{ label: 'Error', value: 'File processing failed', confidence: 0 }]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFieldChange = (index: number, newValue: string) => {
    setFields(prev => {
      const updatedFields = [...prev];
      if (updatedFields[index]) {
        updatedFields[index] = { ...updatedFields[index], value: newValue };
      }
      return updatedFields;
    });
  };

  const handleSaveDocument = async () => {
    if (file && docType && !selectedDocId) {
      try {
        const id = await saveDocument(file, docType, fields);
        setSelectedDocId(id);
        alert('Document saved successfully to the local repository!');
        setCurrentView('documents');
        setFile(null);
      } catch (err) {
        console.error(err);
        alert('Error saving document storage limit may be reached.');
      }
    } else if (selectedDocId) {
       alert('This document is already saved in the repository.');
    }
  };

  const handleSelectSavedDocument = (doc: SavedDocument) => {
    setFile(null); // Not a raw File object, so it won't trigger re-saving
    setFileUrl(doc.fileData); // rehydrate base64 directly to viewer
    setDocType(doc.type);
    setFields(doc.fields);
    setSelectedDocId(doc.id);
    setCurrentView('documentDetail');
  };

  // Cleanup effect
  useEffect(() => {
    return () => {
      // Only revoke if it's a blob URL, not a base64 string
      if (fileUrl && fileUrl.startsWith('blob:')) {
         URL.revokeObjectURL(fileUrl);
      }
    };
  }, [fileUrl]);

  const [isSidebarHovered, setIsSidebarHovered] = useState(false);

  return (
    <div className="flex h-screen bg-background overflow-hidden font-sans text-text-primary">
      {/* Sidebar - Collapsible Premium Design */}
      <aside 
        onMouseEnter={() => setIsSidebarHovered(true)}
        onMouseLeave={() => setIsSidebarHovered(false)}
        className={cn(
          "flex flex-col border-r border-border-subtle bg-surface-base transition-all duration-500 ease-in-out z-20 shadow-2xl relative",
          isSidebarHovered ? "w-64" : "w-20"
        )}
      >
        {/* Hover Trigger indicator when collapsed */}
        {!isSidebarHovered && (
          <div className="absolute inset-y-0 left-0 w-2 h-full flex items-center justify-center opacity-30 group-hover:opacity-100 transition-opacity">
            <div className="space-y-1">
              <div className="w-1 h-4 bg-white/20 rounded-full" />
              <div className="w-1 h-4 bg-white/20 rounded-full" />
              <div className="w-1 h-4 bg-white/20 rounded-full" />
            </div>
          </div>
        )}

        <div className="p-6 flex flex-col items-center justify-center space-y-4 pb-8 overflow-hidden">
          <div className={cn(
            "flex items-center justify-center transition-all duration-500 overflow-hidden",
            isSidebarHovered ? "w-[120px] h-[120px]" : "w-10 h-10"
          )}>
            <img src="/updated_icon.png" alt="PRO Document Parser Logo" className="w-full h-full object-contain drop-shadow-lg" />
          </div>
          <div className={cn(
            "flex flex-col items-center justify-center transition-all duration-500 overflow-hidden whitespace-nowrap",
            isSidebarHovered ? "opacity-100 h-auto mt-4" : "opacity-0 h-0 mt-0"
          )}>
            <span className="text-xs font-bold tracking-widest text-white/80 uppercase font-secondary">PRO Document</span>
            <span className="text-xl font-black tracking-tight text-white font-primary">Parser</span>
          </div>
        </div>
        
        <nav className="flex-1 px-4 space-y-2 mt-4 overflow-hidden">
          <NavItem 
            icon={<Layout size={20} />} 
            label="Dashboard" 
            active={currentView === 'dashboard'} 
            onClick={() => setCurrentView('dashboard')} 
            isExpanded={isSidebarHovered}
          />
          <NavItem 
            icon={<Layers size={20} />} 
            label="Documents" 
            active={currentView === 'documents'}
            onClick={() => setCurrentView('documents')}
            isExpanded={isSidebarHovered}
          />
        </nav>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden relative bg-surface-base">
        {/* Top Header */}
        <header className="h-20 border-b border-border-subtle bg-surface-base/80 backdrop-blur-xl flex items-center justify-between px-8 z-10">
          <h2 className="text-lg font-semibold text-white">PRO Document Parser</h2>
          <div className="flex items-center space-x-6">
            <div className="relative hidden md:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50" size={16} />
              <input 
                type="text" 
                placeholder="Search resources..."
                className="pl-10 pr-4 py-2 bg-black/10 rounded-xl text-xs focus:ring-2 focus:ring-white/20 transition-all outline-none border-none text-white placeholder:text-white/50"
              />
            </div>
            <div className="flex items-center space-x-4 border-l border-white/10 pl-6">
              <button className="relative text-white/70 hover:text-white transition-colors">
                <Bell size={20} />
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-error rounded-full" />
              </button>
              <div className="w-8 h-8 rounded-full bg-white border-2 border-white/20 shadow-glow" />
            </div>
          </div>
        </header>

        {/* Dynamic Split Screen Body */}
        <div className="flex-1 overflow-hidden bg-gradient-to-br from-slate-50 relative via-white to-slate-100 rounded-tl-[40px] shadow-[inset_0_4px_40px_rgba(0,0,0,0.04)] border-t border-l border-slate-200">
          {currentView === 'dashboard' ? (
            <div className="h-full w-full animate-fade-in">
              <VisualDashboard onFileSelect={handleFileSelect} isProcessing={isProcessing} />
            </div>
          ) : currentView === 'documents' ? (
             <DocumentGallery onSelectDocument={handleSelectSavedDocument} />
          ) : (
            <div className="h-full flex flex-col space-y-6">
               <div className="flex items-center justify-between">
                <button 
                  onClick={() => setCurrentView('documents')}
                  className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-900 flex items-center space-x-2 transition-colors bg-white rounded-[10px] border border-slate-200 shadow-sm"
                >
                  <History size={14} />
                  <span>Return to Gallery</span>
                </button>
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Status:</span>
                  <div className="flex items-center space-x-1.5 px-3 py-1 bg-primary/10 text-primary rounded-full border border-primary/20">
                    <CheckCircle2 size={12} />
                    <span className="text-[10px] font-bold">{selectedDocId ? 'Saved Document' : 'Extraction Ready'}</span>
                  </div>
                </div>
               </div>
              
              <div className={`flex-1 grid grid-cols-1 ${selectedDocId ? 'max-w-4xl mx-auto w-full' : 'lg:grid-cols-2'} gap-8 min-h-0`}>
                {!selectedDocId && (
                  <div className="h-full min-h-0">
                    <DocumentViewer file={file} fileUrl={fileUrl} />
                  </div>
                )}
                <div className="h-full min-h-0">
                  <DataEditor 
                    docType={docType} 
                    fields={fields} 
                    onFieldChange={handleFieldChange}
                    isProcessing={isProcessing}
                    onSave={!selectedDocId ? handleSaveDocument : undefined}
                    masterData={masterData}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function NavItem({ icon, label, active = false, onClick, isExpanded = true }: { icon: React.ReactNode, label: string, active?: boolean, onClick?: () => void, isExpanded?: boolean }) {
  return (
    <div 
      onClick={onClick}
      className={cn(
      "flex items-center rounded-[10px] cursor-pointer transition-all duration-300",
      isExpanded ? "space-x-3 px-4 py-3" : "justify-center p-3 w-12 mx-auto",
      active 
        ? "bg-white/20 text-white shadow-glow font-bold" 
        : "text-white/60 hover:bg-white/10 hover:text-white"
    )}>
      <div className={cn("flex-shrink-0", !isExpanded && "flex items-center justify-center")}>
        {icon}
      </div>
      <span className={cn(
        "text-sm font-semibold tracking-wide transition-all duration-500 overflow-hidden whitespace-nowrap",
        isExpanded ? "opacity-100 w-auto ml-1" : "opacity-0 w-0"
      )}>{label}</span>
    </div>
  );
}

function FeatureCard({ title, subtitle }: { title: string, subtitle: string }) {
  return (
    <div className="p-4 bg-white rounded-[16px] border border-slate-200 text-center space-y-1 shadow-sm">
      <p className="text-xl font-bold font-secondary text-slate-800">{title}</p>
      <p className="text-[10px] font-bold text-primary uppercase tracking-widest">{subtitle}</p>
    </div>
  );
}
