import React, { useState, useRef } from "react";
import { UploadCloud, FileText, AlertCircle, Sparkles, Check } from "lucide-react";
import { ingestDocument } from "../../api/ingestion";
import { getFriendlyError } from "../../lib/errors";
import type { DocumentOut } from "../../types/round3";

interface IngestionDropzoneProps {
  onUploaded: (doc: DocumentOut) => void;
}

const MAX_BYTES = 15 * 1024 * 1024; // 15 MB
const ALLOWED_EXTS = [".pdf", ".docx"];

function cleanFileNameToTitle(filename: string): string {
  const withoutExt = filename.replace(/\.[^/.]+$/, "");
  const spaced = withoutExt.replace(/[-_]+/g, " ");
  // Title case each word
  return spaced
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export const IngestionDropzone: React.FC<IngestionDropzoneProps> = ({ onUploaded }) => {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleValidateAndSelect = (selectedFile: File) => {
    setErrorMessage(null);

    // Extension check
    const lowerName = selectedFile.name.toLowerCase();
    const isAllowed = ALLOWED_EXTS.some((ext) => lowerName.endsWith(ext));
    if (!isAllowed) {
      setErrorMessage(getFriendlyError("UNSUPPORTED_FILE_TYPE"));
      return;
    }

    // Size check <= 15MB
    if (selectedFile.size > MAX_BYTES) {
      setErrorMessage(getFriendlyError("FILE_TOO_LARGE"));
      return;
    }

    setFile(selectedFile);
    if (!title) {
      setTitle(cleanFileNameToTitle(selectedFile.name));
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleValidateAndSelect(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleValidateAndSelect(e.target.files[0]);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !title.trim()) return;

    setIsUploading(true);
    setErrorMessage(null);

    try {
      const doc = await ingestDocument(file, title.trim());
      // Reset form
      setFile(null);
      setTitle("");
      onUploaded(doc);
    } catch (err: any) {
      const code = err.code || "API_ERROR";
      setErrorMessage(getFriendlyError(code, err.message));
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="p-6 rounded-2xl bg-[#151511] border border-white/10 space-y-4">
      {/* Privacy Notice Banner */}
      <div className="p-3 rounded-xl bg-ai/10 border border-ai/20 flex items-center gap-2.5 text-xs text-ai font-mono">
        <Sparkles size={14} className="shrink-0" />
        <span>
          AI features use a free-tier external model. Use non-confidential sample material only.
        </span>
      </div>

      <form onSubmit={handleUpload} className="space-y-4">
        {/* Hidden native input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={handleFileChange}
          className="hidden"
          id="guideline-file-input"
        />

        {/* Dropzone Container */}
        <div
          role="button"
          tabIndex={0}
          aria-describedby="dropzone-helper-text"
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`p-8 rounded-xl flex flex-col items-center justify-center text-center cursor-pointer transition-all outline-none ${
            isDragOver
              ? "dropzone--over bg-ai/5 border-ai"
              : "dropzone--idle bg-[#0E0E0B]"
          }`}
        >
          <div className="p-3.5 rounded-full bg-[#1D1D18] border border-white/10 text-ai mb-3">
            <UploadCloud size={24} />
          </div>

          {file ? (
            <div className="flex items-center gap-2 text-white font-mono text-xs">
              <FileText size={15} className="text-ai" />
              <span className="font-semibold">{file.name}</span>
              <span className="text-muted text-[11px]">
                ({(file.size / (1024 * 1024)).toFixed(1)} MB)
              </span>
            </div>
          ) : (
            <div>
              <p className="text-xs font-semibold text-white">
                Drop a brand-guideline PDF or DOCX here, or <span className="text-ai underline">browse</span>
              </p>
              <p id="dropzone-helper-text" className="text-[11px] text-muted font-mono mt-1">
                Accepted formats: .pdf, .docx · Maximum size: 15 MB
              </p>
            </div>
          )}
        </div>

        {/* Title Input & Helper Text */}
        <div className="space-y-1.5">
          <label htmlFor="guideline-title" className="block text-xs font-mono uppercase text-muted">
            Document Title (Citation Prefix)
          </label>
          <input
            id="guideline-title"
            type="text"
            maxLength={200}
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Lumora Brand Book 2026"
            className="w-full px-3.5 py-2.5 bg-[#0E0E0B] border border-white/10 rounded-xl text-xs text-white placeholder-muted/50 focus:border-ai focus:outline-none font-mono"
          />
          <p className="text-[10px] text-muted font-mono">
            Shown in citations, e.g. “Brand Book 2026, Page 14”.
          </p>
        </div>

        {/* Error Banner */}
        {errorMessage && (
          <div className="p-3 rounded-xl bg-critical/10 border border-critical/30 flex items-center gap-2 text-xs text-critical font-mono">
            <AlertCircle size={15} className="shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Upload Button */}
        <div className="flex items-center justify-end">
          <button
            type="submit"
            disabled={!file || !title.trim() || isUploading}
            className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-black text-xs font-bold transition-all shadow-md flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isUploading ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                <span>Ingesting & Parsing Document...</span>
              </>
            ) : (
              <>
                <Check size={14} strokeWidth={2.5} />
                <span>Start Guideline Extraction</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
