"use client";

import { useEffect, useState } from "react";
import { apiFetch, apiBaseUrl } from "../../lib/api";
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

const apiPublicUrl = apiBaseUrl.replace(/\/api$/, "");

function resolveImageUrl(url?: string): string {
  if (!url) return "";
  if (url.startsWith("http")) return url;
  return `${apiPublicUrl}${url}`;
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

  const allPhotos = albums.flatMap((album) =>
    album.photos.map((photo) => ({
      ...photo,
      albumTitle: album.title,
      albumDescription: album.description,
    }))
  );

  return (
    <div className="public-page">
      <section className="section hero hero--small">
        <MoraScrollReveal>
          <h1>Galería</h1>
          <p>Resultados reales de transformaciones en Mora Spa.</p>
        </MoraScrollReveal>
      </section>

      <section className="section">
        <div className="content">
          {loading && (
            <div className="center" style={{ padding: "4rem 0" }}>
              <div className="spinner" />
              <p style={{ marginTop: 12, color: "var(--muted)" }}>Cargando galería...</p>
            </div>
          )}

          {error && (
            <div className="center" style={{ padding: "4rem 0", color: "var(--danger)" }}>
              {error}
            </div>
          )}

          {!loading && !error && allPhotos.length === 0 && (
            <div className="center" style={{ padding: "4rem 0", color: "var(--muted)" }}>
              Aún no hay fotos públicas en la galería.
            </div>
          )}

          {!loading && !error && allPhotos.length > 0 && (
            <MoraScrollReveal>
              <div className="gallery-grid">
                {allPhotos.map((photo, index) => (
                  <button
                    key={photo.id}
                    className="gallery-item"
                    onClick={() =>
                      setLightbox({
                        url: resolveImageUrl(photo.url),
                        title: photo.albumTitle,
                      })
                    }
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <img
                      src={resolveImageUrl(photo.url)}
                      alt={photo.fileName ?? photo.albumTitle}
                      loading="lazy"
                    />
                    <div className="gallery-overlay">
                      <span className="gallery-title">{photo.albumTitle}</span>
                      {photo.albumDescription && (
                        <span className="gallery-desc">{photo.albumDescription}</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </MoraScrollReveal>
          )}
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
