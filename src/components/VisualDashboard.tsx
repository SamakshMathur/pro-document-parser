"use client";

import React from 'react';
import { FileUpload } from './FileUpload';
import { 
  FileText, 
  Grid, 
  Gavel, 
  Layout, 
  Image as ImageIcon, 
  Files, 
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
    <div className="relative w-full h-full flex flex-col items-center overflow-y-auto select-none bg-slate-50/30">
      <div className="relative w-full min-h-[900px] flex items-center justify-center p-8">
        {/* Background SVG for curved connector lines */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 1000 600" preserveAspectRatio="xMidYMid slice" style={{ zIndex: 0 }}>
          <defs>
            <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="rgba(10, 147, 150, 0.2)" />
              <stop offset="50%" stopColor="rgba(10, 147, 150, 0.6)" />
              <stop offset="100%" stopColor="rgba(10, 147, 150, 0.2)" />
            </linearGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>
          
          {/* Left side connections (5 Inputs to Hub edge) */}
          <path d="M 120,100 Q 250,100 330,220" fill="none" stroke="url(#lineGradient)" strokeWidth="2.5" strokeDasharray="10,5" className="animate-pulse" filter="url(#glow)" />
          <path d="M 120,200 Q 250,200 330,260" fill="none" stroke="url(#lineGradient)" strokeWidth="2" strokeDasharray="8,4" />
          <path d="M 120,300 Q 250,300 330,300" fill="none" stroke="url(#lineGradient)" strokeWidth="2" strokeDasharray="8,4" />
          <path d="M 120,400 Q 250,400 330,340" fill="none" stroke="url(#lineGradient)" strokeWidth="2" strokeDasharray="8,4" />
          <path d="M 120,500 Q 250,500 330,380" fill="none" stroke="url(#lineGradient)" strokeWidth="2.5" strokeDasharray="10,5" />

          {/* Right side connections (Outcome edges to Hub edge) - Ends at left edge of cards to avoid text overlap */}
          <path d="M 770,100 Q 750,100 670,220" fill="none" stroke="url(#lineGradient)" strokeWidth="2.5" strokeDasharray="10,5" filter="url(#glow)" />
          <path d="M 770,220 Q 750,220 670,260" fill="none" stroke="url(#lineGradient)" strokeWidth="2.5" strokeDasharray="10,5" />
          <path d="M 770,340 Q 750,340 670,300" fill="none" stroke="url(#lineGradient)" strokeWidth="2.5" strokeDasharray="10,5" />
          <path d="M 770,460 Q 750,420 670,340" fill="none" stroke="url(#lineGradient)" strokeWidth="2.5" strokeDasharray="10,5" />
          <path d="M 770,580 Q 750,460 670,380" fill="none" stroke="url(#lineGradient)" strokeWidth="2.5" strokeDasharray="10,5" filter="url(#glow)" />
        </svg>

        <div className="relative z-10 w-full flex items-center justify-between max-w-7xl h-full">
          {/* Left Column: Input Types (5 Nodes) */}
          <div className="flex flex-col space-y-12 lg:space-y-16">
            <InputNode icon={<Grid size={20} />} label="Table data" />
            <InputNode icon={<Layout size={20} />} label="Complex layouts" />
            <InputNode icon={<ImageIcon size={20} />} label="long images" />
            <InputNode icon={<Gavel size={20} />} label="legal contracts" />
            <InputNode icon={<Files size={20} />} label="Multiple page documetns" />
          </div>

          {/* Center: Processing Hub */}
          <div className="flex-1 flex flex-col items-center justify-center px-6 lg:px-12 space-y-8 lg:space-y-12">
            <div className="relative group">
              <div className="absolute -inset-2 bg-gradient-to-r from-primary/30 to-secondary/30 rounded-[32px] blur-xl opacity-30 group-hover:opacity-60 transition duration-1000"></div>
              <div className="relative bg-white p-3 rounded-[28px] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.1)] border border-slate-100 min-w-[340px]">
                 <FileUpload onFileSelect={onFileSelect} isLoading={isProcessing} />
              </div>
              
              {isProcessing && (
                <div className="absolute -inset-1 rounded-[30px] border-4 border-dotted border-primary animate-[spin_4s_linear_infinite]"></div>
              )}
            </div>
            
            <div className="text-center space-y-3 pointer-events-none">
              <h3 className="text-3xl font-extrabold font-secondary text-slate-900 tracking-tight">Intelligence Neural Core</h3>
              <div className="flex items-center justify-center space-x-3">
                <span className="h-[1px] w-6 bg-slate-200"></span>
                <p className="text-sm font-medium text-slate-500 uppercase tracking-[0.2em]">Next-Gen Processing</p>
                <span className="h-[1px] w-6 bg-slate-200"></span>
              </div>
              <p className="text-slate-400 text-sm max-w-sm mx-auto">
                Real-time classification and semantic extraction with hyper-accurate OCR technology.
              </p>
            </div>
          </div>

          {/* Right Column: Processing Outcomes */}
          <div className="flex flex-col space-y-8 lg:space-y-10">
            <OutputNode icon={<FileSearch size={22} />} label="Information search (RAG)" active color="bg-white" />
            <OutputNode icon={<Zap size={22} />} label="Classification Engine" color="bg-primary/[0.03]" iconClass="text-primary" />
            <SearchingNode icon={<Search size={22} />} label="Contextual Refinement" color="bg-slate-50/50" />
            <OutputNode icon={<Layout size={22} />} label="Process Automation" color="bg-emerald-50/30" />
            <OutputNode icon={<Search size={22} />} label="Smart Summarization" color="bg-indigo-50/30" />
            <OutputNode icon={<MessageSquare size={22} />} label="Contextual Q&A" color="bg-rose-50/30" />
          </div>
        </div>
      </div>
    </div>
  );
};

function SearchingNode({ icon, label, color }: { icon: React.ReactNode, label: string, color: string }) {
  return (
    <div className={cn(
      "flex items-center space-x-4 p-5 rounded-[24px] border border-slate-200 shadow-xl transition-all duration-300 transform hover:scale-105 cursor-pointer",
      color
    )}>
      <div className="flex items-center justify-center text-slate-700 animate-spin-slow">
        {icon}
      </div>
      <span className="text-sm font-bold text-slate-800 tracking-tight pr-4">{label}</span>
    </div>
  );
}

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
