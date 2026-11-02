import React, { useState, useRef } from "react";
import { UploadCloud, Image as ImageIcon, AlertCircle } from "lucide-react";
import { uploadAsset } from "../../api/assets";
import { getFriendlyError } from "../../lib/errors";
import type { AssetOut } from "../../types/round3";

interface AssetDropzoneProps {
  submissionId: number;
  onUploaded: (asset: AssetOut) => void;
  disabled?: boolean;
  disabledReason?: string;
  isCompact?: boolean;
}

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIMES = ["image/png", "image/jpeg", "image/webp"];

export const AssetDropzone: React.FC<AssetDropzoneProps> = ({
  submissionId,
  onUploaded,
  disabled = false,
  disabledReason,
  isCompact = false,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleValidateAndUpload = async (file: File) => {
    if (disabled) return;
    setErrorMessage(null);

    if (!ALLOWED_MIMES.includes(file.type)) {
      setErrorMessage(getFriendlyError("UNSUPPORTED_FILE_TYPE"));
      return;
    }

    if (file.size > MAX_IMAGE_BYTES) {
      setErrorMessage(getFriendlyError("FILE_TOO_LARGE"));
      return;
    }

    setIsUploading(true);
    try {
      const asset = await uploadAsset(submissionId, file);
      onUploaded(asset);
    } catch (err: any) {
      const code = err.code || "API_ERROR";
      setErrorMessage(getFriendlyError(code, err.message));
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleValidateAndUpload(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleValidateAndUpload(e.target.files[0]);
    }
  };

  if (isCompact) {
    return (
      <div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={handleChange}
          className="hidden"
        />
        <button
          type="button"
          disabled={disabled || isUploading}
          title={disabled ? disabledReason : "Upload additional creative image"}
          onClick={() => fileInputRef.current?.click()}
          className="px-3.5 py-2 rounded-xl bg-[#1D1D18] hover:bg-white/10 border border-white/10 text-xs font-semibold text-white flex items-center gap-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isUploading ? (
            <>
              <div className="w-3 h-3 border-2 border-ai border-t-transparent rounded-full animate-spin" />
              <span>Analyzing asset...</span>
            </>
          ) : (
            <>
              <UploadCloud size={14} className="text-ai" />
              <span>Add Another Image</span>
            </>
          )}
        </button>
        {errorMessage && (
          <p className="mt-1.5 text-xs text-critical font-mono">{errorMessage}</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={handleChange}
        className="hidden"
      />

      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        onClick={() => !disabled && !isUploading && fileInputRef.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !disabled && !isUploading) {
            e.preventDefault();
            fileInputRef.current?.click();
          }
        }}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`p-10 rounded-2xl border flex flex-col items-center justify-center text-center transition-all outline-none ${
          disabled
            ? "bg-[#12120E] border-white/5 opacity-50 cursor-not-allowed"
            : isDragOver
            ? "dropzone--over bg-ai/5 border-ai cursor-pointer"
            : "dropzone--idle bg-[#0E0E0B] hover:border-white/20 cursor-pointer"
        }`}
      >
        <div className="p-4 rounded-full bg-[#1D1D18] border border-white/10 text-ai mb-3 shadow-md">
          {isUploading ? (
            <div className="w-6 h-6 border-2 border-ai border-t-transparent rounded-full animate-spin" />
          ) : (
            <ImageIcon size={26} />
          )}
        </div>

        {isUploading ? (
          <div className="space-y-1 font-mono">
            <p className="text-xs font-bold text-white">
              Measuring colours… checking text contrast (up to 8 s)
            </p>
            <p className="text-[11px] text-ai animate-pulse">
              Running vision model compliance heuristics...
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            <p className="text-sm font-semibold text-white">
              {disabled ? (
                disabledReason || "Asset uploading is locked."
              ) : (
                <>
                  Add your banner or social image (PNG, JPG, WebP · up to 5 MB)
                </>
              )}
            </p>
            <p className="text-xs text-muted font-mono">
              Deterministic palette validation & WCAG AA contrast analysis
            </p>
          </div>
        )}
      </div>

      {errorMessage && (
        <div className="p-3 rounded-xl bg-critical/10 border border-critical/30 flex items-center gap-2 text-xs text-critical font-mono">
          <AlertCircle size={14} className="shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}
    </div>
  );
};
