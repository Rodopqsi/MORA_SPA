'use client';

import { useRef, useState } from 'react';
import { uploadImages, deleteUpload, type UploadBucket } from '../lib/uploads';

export type UploaderImage = {
  url: string;
  fileName?: string;
  source: 'URL' | 'LOCAL';
  isCover: boolean;
};

type Props = {
  bucket: UploadBucket;
  value: UploaderImage[];
  onChange: (images: UploaderImage[]) => void;
  maxFiles?: number;
  label?: string;
};

const isLocalUrl = (url: string) => url.startsWith('/uploads/') || url.startsWith('data:image/');

const newBlank = (): UploaderImage => ({
  url: '',
  fileName: '',
  source: 'URL',
  isCover: false
});

const ensureCover = (images: UploaderImage[]): UploaderImage[] => {
  const cleaned = images.filter((img) => img.url.trim().length > 0);
  if (cleaned.length === 0) return [];
  const coverIndex = cleaned.findIndex((img) => img.isCover);
  return cleaned.map((img, index) => ({
    ...img,
    isCover: coverIndex === -1 ? index === 0 : index === coverIndex
  }));
};

export default function ImageUploader({ bucket, value, onChange, maxFiles = 8, label }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const handleFiles = async (filesList: FileList | null) => {
    if (!filesList || filesList.length === 0) return;
    setError('');
    setUploading(true);
    try {
      const files = Array.from(filesList);
      const remaining = maxFiles - value.length;
      if (files.length > remaining) {
        throw new Error(`Solo puedes agregar ${remaining} imagen(es) mas (maximo ${maxFiles}).`);
      }
      const uploaded = await uploadImages(files, bucket);
      const next: UploaderImage[] = [
        ...value,
        ...uploaded.map((u) => ({
          url: u.url,
          fileName: u.fileName,
          source: 'LOCAL' as const,
          isCover: false
        }))
      ];
      onChange(ensureCover(next));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al subir');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleRemove = async (index: number) => {
    setError('');
    const target = value[index];
    if (target && isLocalUrl(target.url)) {
      try {
        await deleteUpload(target.url);
      } catch {
        // ignore
      }
    }
    const next = value.filter((_, i) => i !== index);
    onChange(ensureCover(next));
  };

  const handleSetCover = (index: number) => {
    onChange(
      value.map((img, i) => ({
        ...img,
        isCover: i === index
      }))
    );
  };

  const handleAddUrl = () => {
    if (value.length >= maxFiles) {
      setError(`Maximo ${maxFiles} imagenes.`);
      return;
    }
    onChange(ensureCover([...value, newBlank()]));
  };

  const handleUrlChange = (index: number, url: string) => {
    const next = value.map((img, i) =>
      i === index
        ? {
            ...img,
            url,
            source: url.startsWith('http://') || url.startsWith('https://') ? ('URL' as const) : ('LOCAL' as const)
          }
        : img
    );
    onChange(next);
  };

  return (
    <div className="uploader">
      {label && <div className="uploader-label">{label}</div>}

      <div className="uploader-grid">
        {value.map((img, index) => (
          <div key={`${img.url}-${index}`} className={`uploader-tile ${img.isCover ? 'is-cover' : ''}`}>
            {img.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={img.url} alt={`Imagen ${index + 1}`} />
            ) : (
              <input
                className="uploader-url-input"
                placeholder="https://..."
                value={img.url}
                onChange={(e) => handleUrlChange(index, e.target.value)}
              />
            )}
            <div className="uploader-actions">
              {!img.isCover && img.url && (
                <button
                  type="button"
                  className="uploader-chip"
                  onClick={() => handleSetCover(index)}
                  title="Marcar como portada"
                >
                  Portada
                </button>
              )}
              {img.isCover && <span className="uploader-chip is-active">Portada</span>}
              <button
                type="button"
                className="uploader-remove"
                onClick={() => handleRemove(index)}
                aria-label="Quitar imagen"
                title="Quitar"
              >
                ×
              </button>
            </div>
          </div>
        ))}

        {value.length < maxFiles && (
          <button
            type="button"
            className="uploader-add"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? <span className="uploader-spinner" /> : <span className="uploader-add-plus">+</span>}
            <span>{uploading ? 'Subiendo...' : 'Subir imagen'}</span>
          </button>
        )}
      </div>

      <div className="uploader-helpers">
        <button type="button" className="uploader-link" onClick={handleAddUrl} disabled={value.length >= maxFiles}>
          O pegar URL manualmente
        </button>
        <span className="uploader-counter">
          {value.length}/{maxFiles}
        </span>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple
        hidden
        onChange={(e) => handleFiles(e.target.files)}
      />

      {error && <div className="uploader-error">{error}</div>}
    </div>
  );
}
