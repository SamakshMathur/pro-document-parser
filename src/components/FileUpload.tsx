"use client";

import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, File, X, CheckCircle2 } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  isLoading?: boolean;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onFileSelect, isLoading }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      setSelectedFile(file);
      onFileSelect(file);
    }
  }, [onFileSelect]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/*': ['.jpeg', '.jpg', '.png']
    },
    multiple: false,
    disabled: isLoading
  });

  const removeFile = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedFile(null);
  };

  return (
    <div
      {...getRootProps()}
      className={cn(
        "relative group cursor-pointer transition-all duration-300 ease-in-out",
        "flex flex-col items-center justify-center p-8 rounded-[16px] border-2 border-dashed",
        "bg-white/70 backdrop-blur-md shadow-sm",
        isDragActive ? "border-primary bg-primary/5" : "border-slate-200 hover:border-slate-300",
        isLoading && "opacity-50 cursor-not-allowed"
      )}
    >
      <input {...getInputProps()} />
      
      {selectedFile ? (
        <div className="flex flex-col items-center space-y-4 animate-in fade-in zoom-in duration-300">
          <div className="relative">
            <div className="p-4 bg-primary/10 rounded-[10px] text-primary">
              <File size={48} />
            </div>
            <button
              onClick={removeFile}
              className="absolute -top-2 -right-2 p-1 bg-white rounded-full shadow-md border border-slate-200 hover:scale-110 transition-transform"
            >
              <X size={16} className="text-slate-500" />
            </button>
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-slate-800 truncate max-w-[200px]">
              {selectedFile.name}
            </p>
            <p className="text-xs text-slate-500">
              {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
            </p>
          </div>
          {isLoading && (
            <div className="flex items-center space-x-2 text-primary">
              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              <span className="text-xs font-medium">Processing...</span>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center space-y-4 text-center">
          <div className="p-4 bg-slate-50 border border-slate-100 rounded-[16px] text-slate-400 group-hover:scale-110 transition-transform duration-300">
            <Upload size={48} />
          </div>
          <div>
            <p className="text-lg font-bold font-secondary text-slate-800">
              {isDragActive ? "Drop the file here" : "Upload document"}
            </p>
            <p className="text-sm text-slate-500">
              Drag & drop or click to browse
            </p>
          </div>
          <div className="flex items-center space-x-2 px-4 py-2 bg-slate-50 border border-slate-200 rounded-[6px]">
            <span className="text-[10px] font-bold text-slate-400 tracking-wider">PDF • JPG • PNG</span>
          </div>
        </div>
      )}
    </div>
  );
};
