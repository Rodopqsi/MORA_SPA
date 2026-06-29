"use client";

import { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';

export default function CloudinaryBanner() {
  const [status, setStatus] = useState<{ cloudinary?: boolean } | null>(null);

  useEffect(() => {
    apiFetch<{ cloudinary?: boolean }>('/upload-config')
      .then((res) => setStatus(res))
      .catch(() => setStatus({ cloudinary: false }));
  }, []);

  if (status?.cloudinary !== false) return null;

  return (
    <div
      style={{
        background: '#fff3e0',
        border: '1px solid #ff9800',
        color: '#e65100',
        padding: '10px 16px',
        borderRadius: 12,
        fontSize: 14,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        marginBottom: 12
      }}
    >
      <span style={{ fontSize: 18 }}>⚠️</span>
      <span>
        <strong>Imagenes temporales:</strong> Cloudinary no esta configurado. Las imagenes se guardan localmente y se
        perderan en el proximo deploy. Configura CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY y CLOUDINARY_API_SECRET en
        Render.
      </span>
    </div>
  );
}
