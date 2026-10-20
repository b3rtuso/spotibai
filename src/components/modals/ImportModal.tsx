import React, { useRef, useState } from 'react';
import { X, UploadCloud, Folder, FileAudio, CheckCircle2 } from 'lucide-react';
import { useUiStore } from '../../store/uiStore';
import { useLibraryStore } from '../../store/libraryStore';

export const ImportModal: React.FC = () => {
  const { isImportModalOpen, setImportModalOpen } = useUiStore();
  const { importLocalFiles } = useLibraryStore();
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importedCount, setImportedCount] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isImportModalOpen) return null;

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsProcessing(true);
    setImportedCount(null);

    const count = await importLocalFiles(Array.from(files));
    setIsProcessing(false);
    setImportedCount(count);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    await handleFiles(e.dataTransfer.files);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-spotify-card border border-white/10 w-full max-w-lg rounded-2xl p-6 shadow-2xl relative select-none">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-spotify-green/20 text-spotify-green">
              <Folder className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Import Local Music</h2>
              <p className="text-xs text-spotify-subdued">Add audio files from your PC directly to Spotibai</p>
            </div>
          </div>
          <button
            onClick={() => {
              setImportModalOpen(false);
              setImportedCount(null);
            }}
            className="p-1.5 rounded-full hover:bg-white/10 text-neutral-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drop Zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
            isDragging
              ? 'border-spotify-green bg-spotify-green/10 scale-[1.01]'
              : 'border-white/15 hover:border-white/30 bg-white/5 hover:bg-white/[0.07]'
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            multiple
            accept="audio/*,.mp3,.flac,.wav,.m4a,.ogg,.aac"
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />

          <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center text-spotify-green mb-4">
            <UploadCloud className="w-8 h-8" />
          </div>

          <h3 className="text-base font-bold text-white mb-1">
            Drag & drop audio files or folders here
          </h3>
          <p className="text-xs text-spotify-subtext mb-4">
            Supports MP3, FLAC, WAV, M4A, OGG with automatic ID3 album art parsing
          </p>

          <button
            type="button"
            className="px-5 py-2.5 rounded-full bg-white text-black text-xs font-bold hover:scale-105 active:scale-95 transition-transform"
          >
            Browse Files On PC
          </button>
        </div>

        {/* Status / Feedback */}
        {isProcessing && (
          <div className="mt-4 p-3 rounded-xl bg-white/5 border border-white/10 flex items-center gap-3">
            <div className="w-4 h-4 border-2 border-spotify-green border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-medium text-neutral-300">
              Extracting metadata & album artwork...
            </span>
          </div>
        )}

        {importedCount !== null && (
          <div className="mt-4 p-3 rounded-xl bg-spotify-green/10 border border-spotify-green/30 flex items-center gap-3 text-spotify-green">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            <span className="text-xs font-semibold">
              Successfully imported {importedCount} track{importedCount === 1 ? '' : 's'}! Ready to play offline.
            </span>
          </div>
        )}

        <div className="mt-5 text-[11px] text-neutral-500 text-center">
          Files are processed locally and securely stored inside your browser's persistent IndexedDB.
        </div>
      </div>
    </div>
  );
};
