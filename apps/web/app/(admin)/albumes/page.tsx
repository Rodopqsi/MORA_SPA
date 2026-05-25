"use client";

import { useEffect, useRef, useState } from 'react';
import { staffFetch } from '../../lib/staffApi';

type AlbumPhoto = {
  id: number;
  url: string;
  fileName?: string | null;
  isCover?: boolean;
};

type Album = { id: number; title: string; clientId: number; photos?: AlbumPhoto[] };
type Client = { id: number; name: string };

type PhotoForm = {
  url: string;
  fileName: string;
  type: 'ANTES' | 'DESPUES' | 'RESULTADO';
};

const emptyPhoto = (): PhotoForm => ({ url: '', fileName: '', type: 'RESULTADO' });

export default function AlbumesPage() {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [form, setForm] = useState({ title: '', clientId: '', description: '', privacy: 'INTERNO' });
  const [photos, setPhotos] = useState<PhotoForm[]>([emptyPhoto()]);
  const [error, setError] = useState('');
  const formRef = useRef<HTMLDivElement>(null);

  const loadData = () => {
    Promise.all([
      staffFetch<{ data: Album[] }>('/albums'),
      staffFetch<{ data: Client[] }>('/clients')
    ])
      .then(([albumRes, clientRes]) => {
        setAlbums(albumRes.data ?? []);
        setClients(clientRes.data ?? []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Error'));
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      const validPhotos = photos
        .map((photo, index) => ({
          ...photo,
          url: photo.url.trim(),
          fileName: photo.fileName.trim(),
          order: index + 1,
          isCover: index === 0
        }))
        .filter((photo) => photo.url.length > 0);

      await staffFetch('/albums', {
        method: 'POST',
        body: JSON.stringify({
          title: form.title,
          clientId: Number(form.clientId),
          description: form.description || undefined,
          privacy: form.privacy,
          photos: validPhotos.map((photo) => ({
            url: photo.url,
            fileName: photo.fileName || undefined,
            type: photo.type,
            order: photo.order,
            isCover: photo.isCover
          }))
        })
      });
      setForm({ title: '', clientId: '', description: '', privacy: 'INTERNO' });
      setPhotos([emptyPhoto()]);
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    }
  };

  const updatePhoto = (index: number, patch: Partial<PhotoForm>) => {
    setPhotos((current) => current.map((photo, currentIndex) => (currentIndex === index ? { ...photo, ...patch } : photo)));
  };

  const addPhotoField = () => {
    setPhotos((current) => [...current, emptyPhoto()]);
  };

  const removePhotoField = (index: number) => {
    setPhotos((current) => (current.length === 1 ? [emptyPhoto()] : current.filter((_, currentIndex) => currentIndex !== index)));
  };

  const clientName = (clientId: number) =>
    clients.find((client) => client.id === clientId)?.name ?? `Cliente #${clientId}`;

  return (
    <div className="page-stack">
      <header className="page-head">
        <div>
          <div className="eyebrow">Albumes y recuerdos</div>
          <h1>Historias visuales de transformacion</h1>
          <p>Organiza antes y despues, con permisos claros.</p>
        </div>
        <div className="page-actions">
          <button className="btn" onClick={() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
            Nuevo album
          </button>
        </div>
      </header>

      <section className="card reveal" ref={formRef}>
        <div className="section-head">
          <div>
            <div className="eyebrow">Nuevo album</div>
            <h2>Registrar album</h2>
          </div>
        </div>
        <form className="auth-form" onSubmit={handleCreate}>
          <label>
            Titulo
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </label>
          <label>
            Cliente
            <select value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })}>
              <option value="">Selecciona</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>{client.name}</option>
              ))}
            </select>
          </label>
          <label>
            Descripcion
            <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </label>
          <label>
            Privacidad
            <select value={form.privacy} onChange={(e) => setForm({ ...form, privacy: e.target.value })}>
              <option value="INTERNO">INTERNO</option>
              <option value="PRIVADO_CLIENTE">PRIVADO_CLIENTE</option>
              <option value="PUBLICO">PUBLICO</option>
            </select>
          </label>
          <div>
            <div className="section-head" style={{ marginBottom: 12 }}>
              <div>
                <div className="eyebrow">Imagenes</div>
                <h2>Cargar enlaces de fotos</h2>
              </div>
              <button className="chip" type="button" onClick={addPhotoField}>Agregar foto</button>
            </div>
            <div className="grid grid-2">
              {photos.map((photo, index) => (
                <div key={index} className="card" style={{ padding: 16 }}>
                  <label>
                    URL de la imagen
                    <input
                      value={photo.url}
                      onChange={(e) => updatePhoto(index, { url: e.target.value })}
                      placeholder="https://..."
                    />
                  </label>
                  <label>
                    Nombre del archivo
                    <input
                      value={photo.fileName}
                      onChange={(e) => updatePhoto(index, { fileName: e.target.value })}
                      placeholder="antes-corte.jpg"
                    />
                  </label>
                  <label>
                    Tipo
                    <select value={photo.type} onChange={(e) => updatePhoto(index, { type: e.target.value as PhotoForm['type'] })}>
                      <option value="ANTES">ANTES</option>
                      <option value="DESPUES">DESPUES</option>
                      <option value="RESULTADO">RESULTADO</option>
                    </select>
                  </label>
                  <div className="service-actions">
                    <span className="pill">{index === 0 ? 'Portada' : `Foto ${index + 1}`}</span>
                    <button className="chip" type="button" onClick={() => removePhotoField(index)}>Quitar</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          {error && <div className="auth-error">{error}</div>}
          <button className="btn" type="submit">Guardar</button>
        </form>
      </section>

      <section className="grid grid-4">
        {albums.map((album, index) => (
          <div
            key={album.id}
            className="card album-card reveal"
            style={{ animationDelay: `${index * 80}ms` }}
          >
            <div className="album-thumb">
              {album.photos?.[0]?.url ? (
                <img
                  src={album.photos[0].url}
                  alt={album.photos[0].fileName || album.title}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 20 }}
                />
              ) : (
                <div className="album-glow" />
              )}
              <div className="album-count">{album.photos?.length ?? 0} fotos</div>
            </div>
            <div className="album-title">{album.title}</div>
            <div className="album-sub">Cliente: {clientName(album.clientId)}</div>
          </div>
        ))}
      </section>
    </div>
  );
}
