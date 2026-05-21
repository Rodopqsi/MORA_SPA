"use client";

import { useEffect, useState } from 'react';
import { staffFetch } from '../../lib/staffApi';

type Album = { id: number; title: string; clientId: number; photos?: { id: number }[] };
type Client = { id: number; name: string };

export default function AlbumesPage() {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [form, setForm] = useState({ title: '', clientId: '', description: '', privacy: 'INTERNO' });
  const [error, setError] = useState('');

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
      await staffFetch('/albums', {
        method: 'POST',
        body: JSON.stringify({
          title: form.title,
          clientId: Number(form.clientId),
          description: form.description || undefined,
          privacy: form.privacy
        })
      });
      setForm({ title: '', clientId: '', description: '', privacy: 'INTERNO' });
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    }
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
          <button className="btn">Nuevo album</button>
        </div>
      </header>

      <section className="card reveal">
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
              <div className="album-glow" />
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
