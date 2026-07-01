"use client";

import { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';

export default function CloudinaryBanner() {
  const [status, setStatus] = useState<{ cloudinary?: boolean } | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setDismissed(sessionStorage.getItem('cloudinaryBannerDismissed') === '1');
    apiFetch<{ cloudinary?: boolean }>('/upload-config')
      .then((res) => setStatus(res))
      .catch(() => setStatus({ cloudinary: false }));
  }, []);

  if (status?.cloudinary !== false) return null;
  if (dismissed) return null;

  return (
    <div
      style={{
        background: '#fff3e0',
        border: '1px solid #ff9800',
        color: '#bf360c',
        padding: '12px 16px',
        borderRadius: 14,
        fontSize: 14,
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        marginBottom: 12,
        lineHeight: 1.5,
      }}
    >
      <span style={{ fontSize: 22, flexShrink: 0, marginTop: 2 }}>⚠️</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <strong style={{ display: 'block', marginBottom: 4 }}>
          Imágenes temporales — riesgo de pérdida
        </strong>
        <span>
          Cloudinary no está configurado. Las imágenes se guardan en el disco local del servidor
          y se <strong>perderán en el próximo deploy o reinicio</strong> de Render.
          Los visitantes de tu web no podrán ver fotos subidas en sesiones anteriores.
        </span>
        <div style={{ marginTop: 8, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <a
            href="https://cloudinary.com/console"
            target="_blank"
            rel="noreferrer"
            style={{
              color: '#e65100',
              fontWeight: 600,
              textDecoration: 'underline',
            }}
          >
            Ir a Cloudinary
          </a>
          <span style={{ color: '#bf360c' }}>→ Configura en Render: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET</span>
        </div>
      </div>
      <button
        type="button"
        onClick={() => {
          setDismissed(true);
          sessionStorage.setItem('cloudinaryBannerDismissed', '1');
        }}
        aria-label="Cerrar aviso"
        style={{
          background: 'transparent',
          border: 'none',
          color: '#bf360c',
          cursor: 'pointer',
          fontSize: 18,
          padding: 2,
          lineHeight: 1,
          flexShrink: 0,
        }}
      >
        ✕
      </button>
    </div>
  );
}
