'use client';

import { useRef, useState } from 'react';
import { uploadImages, deleteUpload, type UploadBucket } from '../lib/uploads';

type Props = {
  bucket: UploadBucket;
  value: string;
  fallbackInitials: string;
  onChange: (url: string) => void;
  size?: number;
  label?: string;
};

const isLocalUrl = (url: string) => url.startsWith('/uploads/') || url.startsWith('data:image/');

export default function AvatarUploader({
  bucket,
  value,
  fallbackInitials,
  onChange,
  size = 96,
  label
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const handleFiles = async (filesList: FileList | null) => {
    const file = filesList?.[0];
    if (!file) return;
    setError('');
    setUploading(true);
    try {
      const [uploaded] = await uploadImages([file], bucket);
      if (uploaded) {
        if (value && isLocalUrl(value)) {
          try {
            await deleteUpload(value);
          } catch {
            // ignore
          }
        }
        onChange(uploaded.url);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al subir');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleRemove = async () => {
    if (!value) return;
    if (isLocalUrl(value)) {
      try {
        await deleteUpload(value);
      } catch {
        // ignore
      }
    }
    onChange('');
  };

  return (
    <div className="avatar-uploader">
      {label && <div className="avatar-uploader-label">{label}</div>}
      <div className="avatar-uploader-row">
        <div
          className="avatar-circle"
          style={{ width: size, height: size, fontSize: size * 0.36 }}
        >
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="Avatar" />
          ) : (
            <span>{fallbackInitials.slice(0, 2).toUpperCase()}</span>
          )}
        </div>
        <div className="avatar-uploader-actions">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? 'Subiendo...' : value ? 'Cambiar foto' : 'Subir foto'}
          </button>
          {value && (
            <button type="button" className="btn btn-ghost btn-sm danger" onClick={handleRemove}>
              Quitar
            </button>
          )}
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        hidden
        onChange={(e) => handleFiles(e.target.files)}
      />
      {error && <div className="uploader-error">{error}</div>}
    </div>
  );
}
