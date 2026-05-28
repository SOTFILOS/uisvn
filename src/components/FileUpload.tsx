import { useRef, useState, useCallback } from 'react';
import type { DragEvent, ChangeEvent } from 'react';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
}

const ACCEPTED_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.ms-excel', // .xls
];
const ACCEPTED_EXTENSIONS = ['.xlsx', '.xls'];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function isValidFile(file: File): boolean {
  const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
  return (
    ACCEPTED_TYPES.includes(file.type) || ACCEPTED_EXTENSIONS.includes(ext)
  );
}

export default function FileUpload({ onFileSelect }: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  const handleFile = useCallback(
    (file: File) => {
      if (!isValidFile(file)) {
        setFileError('Only .xlsx and .xls files are supported.');
        return;
      }
      setFileError(null);
      setSelectedFile(file);
      onFileSelect(file);
    },
    [onFileSelect]
  );

  // --- Drag events ---
  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const onDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  // --- Input change ---
  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    // Reset so the same file can be re-selected
    e.target.value = '';
  };

  const openPicker = () => inputRef.current?.click();

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Drop zone */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload Excel file — click or drag and drop"
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={openPicker}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && openPicker()}
        style={{
          backgroundColor: isDragging ? '#EBF5F5' : '#FFFFFF',
          borderColor: isDragging ? '#0D9488' : '#E2E0D8',
          borderWidth: 2,
          borderStyle: 'dashed',
          transform: isDragging ? 'scale(1.01)' : 'scale(1)',
          transition: 'all 0.2s ease',
          cursor: 'pointer',
        }}
        className="rounded-2xl p-10 flex flex-col items-center gap-4 select-none outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
      >
        {/* Icon */}
        <div
          style={{
            backgroundColor: isDragging ? '#C6E4E4' : '#EEF0F8',
            transition: 'background-color 0.2s ease',
          }}
          className="w-16 h-16 rounded-2xl flex items-center justify-center"
        >
          <svg
            width="32"
            height="32"
            viewBox="0 0 32 32"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <rect width="32" height="32" rx="8" fill={isDragging ? '#0D9488' : '#E2E0D8'} />
            <path
              d="M10 22h12M16 10v10M12 14l4-4 4 4"
              stroke={isDragging ? '#0B1437' : '#64748B'}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        {/* Text */}
        <div className="text-center">
          <p style={{ fontFamily: 'Roboto, Arial, Helvetica, sans-serif', color: '#0F172A', fontWeight: 600, fontSize: '1rem' }}>
            {isDragging ? 'Release to upload' : 'Drop your Excel file here'}
          </p>
          <p style={{ fontFamily: 'Roboto, Arial, Helvetica, sans-serif', color: '#64748B', fontSize: '0.875rem', marginTop: 4 }}>
            or{' '}
            <span style={{ color: '#0D9488', fontWeight: 600 }}>
              click to browse
            </span>
          </p>
          <p style={{ fontFamily: 'Roboto, Arial, Helvetica, sans-serif', color: '#94A3B8', fontSize: '0.75rem', marginTop: 8 }}>
            Supports .xlsx and .xls files
          </p>
        </div>

        {/* Hidden input */}
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={onChange}
          aria-hidden="true"
          tabIndex={-1}
        />
      </div>

      {/* Error */}
      {fileError && (
        <p
          role="alert"
          style={{
            color: '#DC2626',
            fontFamily: 'Roboto, Arial, Helvetica, sans-serif',
            fontSize: '0.8125rem',
            marginTop: 8,
            textAlign: 'center',
          }}
        >
          {fileError}
        </p>
      )}

      {/* Selected file info */}
      {selectedFile && !fileError && (
        <div
          style={{
            backgroundColor: '#EBF5F5',
            borderColor: '#C6E4E4',
            borderWidth: 1,
            borderStyle: 'solid',
            borderRadius: 12,
            padding: '10px 16px',
            marginTop: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          {/* File icon */}
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path
              d="M4 3C4 2.44772 4.44772 2 5 2H12L16 6V17C16 17.5523 15.5523 18 15 18H5C4.44772 18 4 17.5523 4 17V3Z"
              fill="#0D9488"
              fillOpacity="0.15"
              stroke="#0D9488"
              strokeWidth="1.5"
            />
            <path d="M12 2V6H16" stroke="#0D9488" strokeWidth="1.5" strokeLinejoin="round" />
            <path d="M7 10H13M7 13H11" stroke="#0D9488" strokeWidth="1.5" strokeLinecap="round" />
          </svg>

          <div style={{ flex: 1, minWidth: 0 }}>
            <p
              style={{
                fontFamily: 'Roboto, Arial, Helvetica, sans-serif',
                fontWeight: 600,
                fontSize: '0.8125rem',
                color: '#0F172A',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {selectedFile.name}
            </p>
            <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem', color: '#0D9488' }}>
              {formatBytes(selectedFile.size)}
            </p>
          </div>

          {/* Checkmark */}
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <circle cx="9" cy="9" r="9" fill="#0D9488" />
            <path d="M5.5 9L7.5 11L12.5 6.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      )}
    </div>
  );
}
