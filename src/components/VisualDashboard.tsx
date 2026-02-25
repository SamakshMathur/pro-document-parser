"use client";

import React from 'react';
import { FileUpload } from './FileUpload';
import { 
  FileText, 
  Stethoscope, 
  ShieldCheck, 
  Layout, 
  Image as ImageIcon, 
  RotateCw,
  Search,
  Zap,
  FileSearch,
  MessageSquare,
  Plus
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface VisualDashboardProps {
  onFileSelect: (file: File) => void;
  isProcessing: boolean;
}

export const VisualDashboard: React.FC<VisualDashboardProps> = ({ onFileSelect, isProcessing }) => {
  return (
    <div className="relative w-full h-full flex items-center justify-center p-4 overflow-hidden select-none">
      {/* Background SVG for curved connector lines */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 0 }}>
        <defs>
          <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(10, 147, 150, 0.1)" />
            <stop offset="50%" stopColor="rgba(10, 147, 150, 0.4)" />
            <stop offset="100%" stopColor="rgba(10, 147, 150, 0.1)" />
          </linearGradient>
        </defs>
        
        {/* Left side connections */}
        <path d="M 150,150 Q 350,150 450,350" fill="none" stroke="url(#lineGradient)" strokeWidth="2" strokeDasharray="8,4" className="animate-pulse" />
        <path d="M 150,250 Q 350,250 450,380" fill="none" stroke="url(#lineGradient)" strokeWidth="2" strokeDasharray="8,4" />
        <path d="M 150,350 Q 350,350 450,410" fill="none" stroke="url(#lineGradient)" strokeWidth="2" strokeDasharray="8,4" />
        <path d="M 150,450 Q 350,450 450,440" fill="none" stroke="url(#lineGradient)" strokeWidth="2" strokeDasharray="8,4" />
        <path d="M 150,550 Q 350,550 450,470" fill="none" stroke="url(#lineGradient)" strokeWidth="2" strokeDasharray="8,4" />

        {/* Right side connections */}
        <path d="M 850,150 Q 650,150 550,350" fill="none" stroke="url(#lineGradient)" strokeWidth="2" strokeDasharray="8,4" />
        <path d="M 850,300 Q 650,300 550,400" fill="none" stroke="url(#lineGradient)" strokeWidth="2" strokeDasharray="8,4" />
        <path d="M 850,450 Q 650,450 550,450" fill="none" stroke="url(#lineGradient)" strokeWidth="2" strokeDasharray="8,4" />
        <path d="M 850,600 Q 650,600 550,500" fill="none" stroke="url(#lineGradient)" strokeWidth="2" strokeDasharray="8,4" />
      </svg>

      <div className="relative z-10 w-full flex items-center justify-between max-w-7xl">
        {/* Left Column: Input Types */}
        <div className="flex flex-col space-y-8">
          <InputNode icon={<FileText size={18} />} label="Table data" />
          <InputNode icon={<Stethoscope size={18} />} label="Medical reports" />
          <InputNode icon={<ShieldCheck size={18} />} label="Insurance claims" />
          <InputNode icon={<Layout size={18} />} label="Complex layouts" />
          <InputNode icon={<ImageIcon size={18} />} label="Long images" />
          <InputNode icon={<RotateCw size={18} />} label="Tilted images" />
        </div>

        {/* Center: Processing Hub */}
        <div className="flex-1 flex flex-col items-center justify-center px-12 space-y-8">
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-primary to-secondary rounded-[24px] blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
            <div className="relative bg-white p-2 rounded-[22px] shadow-2xl min-w-[320px]">
               <FileUpload onFileSelect={onFileSelect} isLoading={isProcessing} />
            </div>
            
            {/* Animated Ring of Light during processing */}
            {isProcessing && (
              <div className="absolute inset-0 rounded-[22px] border-4 border-primary border-t-transparent animate-spin"></div>
            )}
          </div>
          
          <div className="text-center space-y-2 pointer-events-none">
            <h3 className="text-2xl font-bold font-secondary text-slate-900 tracking-tight">Intelligence Neural Core</h3>
            <p className="text-sm text-slate-500 max-w-sm">
              Ingesting and structuring unstructured artifacts with 98.5% precision.
            </p>
          </div>
        </div>

        {/* Right Column: Processing Outcomes */}
        <div className="flex flex-col space-y-12">
          <OutputNode icon={<FileSearch size={24} />} label="Information search (RAG)" active color="bg-slate-50" />
          <div className="relative">
            <div className="absolute -left-6 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-slate-200 bg-white flex items-center justify-center">
              <Plus size={10} className="text-slate-400" />
            </div>
             <OutputNode icon={<RotateCw size={24} />} iconClass="opacity-20" color="bg-slate-50/30" label="" hideText />
          </div>
          <OutputNode icon={<Zap size={24} />} label="Process automation" color="bg-primary/5" iconClass="text-primary" />
          <OutputNode icon={<Search size={24} />} label="Summarization" color="bg-emerald-50" />
          <div className="relative">
             <div className="absolute -left-6 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-slate-200 bg-white flex items-center justify-center">
              <Plus size={10} className="text-slate-400" />
            </div>
            <OutputNode icon={<MessageSquare size={24} />} label="Contextual Q&A" color="bg-rose-50" />
          </div>
        </div>
      </div>
    </div>
  );
};

function InputNode({ icon, label }: { icon: React.ReactNode, label: string }) {
  return (
    <div className="flex flex-col items-center space-y-2 group cursor-help transform hover:scale-110 transition-transform">
      <div className="w-12 h-12 bg-white rounded-xl shadow-lg border border-slate-100 flex items-center justify-center text-slate-500 group-hover:text-primary transition-colors">
        {icon}
      </div>
      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</span>
      <div className="h-[1px] w-8 bg-slate-200 group-hover:w-12 transition-all"></div>
    </div>
  );
}

function OutputNode({ 
  icon, 
  label, 
  active = false, 
  color = "bg-white", 
  iconClass = "text-slate-600",
  hideText = false
}: { 
  icon: React.ReactNode, 
  label: string, 
  active?: boolean, 
  color?: string,
  iconClass?: string,
  hideText?: boolean
}) {
  return (
    <div className={cn(
      "flex items-center space-x-4 p-5 rounded-[24px] border border-slate-200 shadow-xl transition-all duration-300 transform hover:scale-105 cursor-pointer",
      color,
      active && "ring-2 ring-primary/20 scale-105"
    )}>
      <div className={cn("flex items-center justify-center text-slate-700", iconClass)}>
        {icon}
      </div>
      {!hideText && <span className="text-sm font-bold text-slate-800 tracking-tight pr-4">{label}</span>}
    </div>
  );
}
