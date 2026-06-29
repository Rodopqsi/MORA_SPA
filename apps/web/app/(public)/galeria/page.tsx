"use client";

import { useEffect, useState } from "react";
import { apiFetch, getApiPublicUrl } from "../../lib/api";
import MoraScrollReveal from "../../components/MoraScrollReveal";

type AlbumPhoto = {
  id: number;
  url: string;
  fileName?: string | null;
  type: string;
  isCover: boolean;
};

type GalleryAlbum = {
  id: number;
  title: string;
  description?: string | null;
  photos: AlbumPhoto[];
  client?: { name: string } | null;
};

function resolveImageUrl(url?: string): string {
  if (!url) return "";
  if (url.startsWith("http")) return url;
  return `${getApiPublicUrl()}${url}`;
}

export const dynamic = "force-dynamic";

export default function GaleriaPage() {
  const [albums, setAlbums] = useState<GalleryAlbum[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lightbox, setLightbox] = useState<{ url: string; title: string } | null>(null);

  useEffect(() => {
    apiFetch<{ data: GalleryAlbum[] }>("/public/gallery")
      .then((res) => setAlbums(res.data ?? []))
      .catch(() => setError("No se pudo cargar la galería"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="public-page">
      <section className="section hero hero--small">
        <MoraScrollReveal>
          <h1>Galería</h1>
          <p>Transformaciones, estilos y momentos capturados en Mora Spa.</p>
        </MoraScrollReveal>
      </section>

      <section className="section">
        <div className="content">
          {loading && (
            <div className="center" style={{ padding: "5rem 0" }}>
              <div className="spinner" />
              <p style={{ marginTop: 14, color: "var(--muted)", fontSize: 14 }}>
                Cargando colección...
              </p>
            </div>
          )}

          {error && (
            <div className="center" style={{ padding: "5rem 0", color: "var(--danger)" }}>
              {error}
            </div>
          )}

          {!loading && !error && albums.length === 0 && (
            <div className="center" style={{ padding: "5rem 0" }}>
              <div
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: "50%",
                  background: "var(--surface)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 16px",
                  fontSize: 32,
                }}
              >
                📷
              </div>
              <p style={{ color: "var(--text)", fontWeight: 500, marginBottom: 6 }}>
                Galería en construcción
              </p>
              <p style={{ color: "var(--muted)", fontSize: 14, maxWidth: 320, margin: "0 auto" }}>
                Pronto compartiremos transformaciones, estilos y momentos del spa.
              </p>
            </div>
          )}

          {!loading &&
            !error &&
            albums.map((album) => (
              <div key={album.id} style={{ marginBottom: 56 }}>
                <MoraScrollReveal>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "baseline",
                      gap: 12,
                      marginBottom: 20,
                      flexWrap: "wrap",
                    }}
                  >
                    <h2
                      style={{
                        fontSize: 20,
                        fontWeight: 600,
                        letterSpacing: "0.2px",
                        color: "var(--text)",
                      }}
                    >
                      {album.title}
                    </h2>
                    {album.client?.name && (
                      <span
                        style={{
                          fontSize: 13,
                          color: "var(--muted)",
                          fontWeight: 500,
                        }}
                      >
                        — {album.client.name}
                      </span>
                    )}
                  </div>
                  {album.description && (
                    <p
                      style={{
                        color: "var(--muted)",
                        fontSize: 14,
                        marginBottom: 20,
                        maxWidth: 600,
                        lineHeight: 1.55,
                      }}
                    >
                      {album.description}
                    </p>
                  )}
                </MoraScrollReveal>
                <div className="gallery-grid">
                  {album.photos.map((photo, index) => (
                    <button
                      key={photo.id}
                      className="gallery-item"
                      onClick={() =>
                        setLightbox({
                          url: resolveImageUrl(photo.url),
                          title: album.title,
                        })
                      }
                      style={{ animationDelay: `${index * 60}ms` }}
                    >
                      <img
                        src={resolveImageUrl(photo.url)}
                        alt={photo.fileName ?? album.title}
                        loading="lazy"
                      />
                      <div className="gallery-overlay">
                        <span className="gallery-title">{album.title}</span>
                        {album.description && (
                          <span className="gallery-desc">{album.description}</span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
        </div>
      </section>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="lightbox"
          onClick={() => setLightbox(null)}
          role="dialog"
          aria-modal="true"
        >
          <button
            className="lightbox-close"
            onClick={() => setLightbox(null)}
            aria-label="Cerrar"
          >
            ✕
          </button>
          <img src={lightbox.url} alt={lightbox.title} />
          <div className="lightbox-caption">{lightbox.title}</div>
        </div>
      )}
    </div>
  );
}
