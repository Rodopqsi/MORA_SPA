"use client";

import { useEffect, useState } from 'react';
import { staffFetch } from '../../lib/staffApi';
import ConfirmDialog from '../../components/ConfirmDialog';
import MoraScrollReveal from '../../components/MoraScrollReveal';
import AdminModalForm from '../../components/AdminModalForm';

type AlbumPrivacy = 'INTERNO' | 'PRIVADO_CLIENTE' | 'PUBLICO';
type PhotoType = 'ANTES' | 'DESPUES' | 'RESULTADO';

type AlbumPhoto = {
  id: number;
  url: string;
  fileName?: string | null;
  isCover?: boolean;
};

type Álbum = {
  id: number;
  title: string;
  clientId: number;
  description?: string | null;
  privacy: AlbumPrivacy;
  photos?: AlbumPhoto[];
};
type Client = { id: number; name: string };

type PhotoForm = {
  url: string;
  fileName: string;
  type: PhotoType;
};

type AlbumForm = {
  id: number | null;
  title: string;
  clientId: string;
  description: string;
  privacy: AlbumPrivacy;
};

const emptyPhoto = (): PhotoForm => ({ url: '', fileName: '', type: 'RESULTADO' });
const createEmptyForm = (): AlbumForm => ({ id: null, title: '', clientId: '', description: '', privacy: 'INTERNO' });

const buildValidPhotos = (photos: PhotoForm[]) => {
  return photos
    .map((photo) => ({
      url: photo.url.trim(),
      fileName: photo.fileName.trim(),
      type: photo.type
    }))
    .filter((photo) => photo.url.length > 0);
};

export default function AlbumesPage() {
  const [albums, setAlbums] = useState<Álbum[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [form, setForm] = useState<AlbumForm>(createEmptyForm());
  const [photos, setPhotos] = useState<PhotoForm[]>([emptyPhoto()]);
  const [error, setError] = useState('');
  const [confirmDeleteAlbum, setConfirmDeleteAlbum] = useState<Álbum | null>(null);
  const [confirmDeletePhotoId, setConfirmDeletePhotoId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [openForm, setOpenForm] = useState(false);
  const [uploadingLocal, setUploadingLocal] = useState(false);
  const editingAlbum = albums.find((album) => album.id === form.id) ?? null;

  const loadData = () => {
    Promise.all([
      staffFetch<{ data: Álbum[] }>('/albums'),
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

  const resetForm = () => {
    setForm(createEmptyForm());
    setPhotos([emptyPhoto()]);
    setError('');
  };

  const openCreate = () => {
    resetForm();
    setOpenForm(true);
  };

  const closeForm = () => setOpenForm(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    try {
      const validPhotos = buildValidPhotos(photos);

      if (form.id) {
        await staffFetch(`/albums/${form.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            title: form.title.trim(),
            clientId: Number(form.clientId),
            description: form.description.trim() || undefined,
            privacy: form.privacy
          })
        });

        if (validPhotos.length) {
          const initialOrder = (editingAlbum?.photos?.length ?? 0) + 1;
          await Promise.all(
            validPhotos.map((photo, index) =>
              staffFetch(`/albums/${form.id}/photos`, {
                method: 'POST',
                body: JSON.stringify({
                  url: photo.url,
                  fileName: photo.fileName || undefined,
                  type: photo.type,
                  order: initialOrder + index,
                  isCover: (editingAlbum?.photos?.length ?? 0) === 0 && index === 0
                })
              })
            )
          );
        }
      } else {
        await staffFetch('/albums', {
          method: 'POST',
          body: JSON.stringify({
            title: form.title.trim(),
            clientId: Number(form.clientId),
            description: form.description.trim() || undefined,
            privacy: form.privacy,
            photos: validPhotos.map((photo, index) => ({
              url: photo.url,
              fileName: photo.fileName || undefined,
              type: photo.type,
              order: index + 1,
              isCover: index === 0
            }))
          })
        });
      }

      resetForm();
      setOpenForm(false);
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

  const handleEdit = (album: Álbum) => {
    setForm({
      id: album.id,
      title: album.title,
      clientId: String(album.clientId),
      description: album.description ?? '',
      privacy: album.privacy
    });
    setPhotos([emptyPhoto()]);
    setOpenForm(true);
  };

  const handleDelete = (album: Álbum) => {
    setConfirmDeleteAlbum(album);
  };

  const handleLocalPhotos = async (filesList: FileList | null) => {
    if (!filesList || filesList.length === 0) return;
    setUploadingLocal(true);
    try {
      const { uploadImages } = await import('../../lib/uploads');
      const uploaded = await uploadImages(Array.from(filesList), 'misc');
      setPhotos((current) => [
        ...current,
        ...uploaded.map((u) => ({ url: u.url, fileName: u.fileName ?? '', type: 'RESULTADO' as PhotoType }))
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al subir');
    } finally {
      setUploadingLocal(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!confirmDeleteAlbum) return;
    setDeleting(true);
    setError('');
    try {
      await staffFetch(`/albums/${confirmDeleteAlbum.id}`, { method: 'DELETE' });
      if (form.id === confirmDeleteAlbum.id) {
        resetForm();
      }
      loadData();
      setConfirmDeleteAlbum(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar');
    } finally {
      setDeleting(false);
    }
  };

  const handleDeletePhoto = (photoId: number) => {
    if (!form.id) return;
    setConfirmDeletePhotoId(photoId);
  };

  const handleDeletePhotoConfirm = async () => {
    if (!form.id || confirmDeletePhotoId === null) return;
    setDeleting(true);
    setError('');
    try {
      await staffFetch(`/albums/${form.id}/photos/${confirmDeletePhotoId}`, { method: 'DELETE' });
      loadData();
      setConfirmDeletePhotoId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar la foto');
    } finally {
      setDeleting(false);
    }
  };

  const clientName = (clientId?: number | null) =>
    clientId ? (clients.find((client) => client.id === clientId)?.name ?? `Cliente #${clientId}`) : null;

  return (
    <div className="page-stack page-enter">
      <header className="page-head">
        <div>
          <div className="eyebrow">Galería</div>
          <h1>Fotos y transformaciones</h1>
          <p>Sube fotos para la galería pública. Marcá como Público para que aparezcan en el sitio.</p>
        </div>
        <div className="page-actions">
          <button className="btn shine-on-hover press-feedback" onClick={openCreate}>
            + Nueva colección
          </button>
        </div>
      </header>

      <AdminModalForm
        open={openForm}
        onClose={closeForm}
        eyebrow={form.id ? 'Editar colección' : 'Nueva colección'}
        title={form.id ? 'Actualizar colección' : 'Registrar colección'}
      >
        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            Título
            <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </label>
          <label>
            Cliente
            <select required value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })}>
              <option value="">Selecciona un cliente</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>{client.name}</option>
              ))}
            </select>
          </label>
          <label>
            Descripción
            <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </label>
          <label>
            Privacidad
            <select value={form.privacy} onChange={(e) => setForm({ ...form, privacy: e.target.value as AlbumPrivacy })}>
              <option value="INTERNO">INTERNO</option>
              <option value="PRIVADO_CLIENTE">PRIVADO_CLIENTE</option>
              <option value="PUBLICO">PUBLICO</option>
            </select>
          </label>
          <div>
            <div className="section-head" style={{ marginBottom: 12 }}>
              <div>
                <div className="eyebrow">Imágenes</div>
                <h2>{form.id ? 'Agregar fotos nuevas' : 'Cargar fotos'}</h2>
              </div>
              <div className="chip-row">
                <label className="chip">
                  {uploadingLocal ? 'Subiendo...' : 'Subir archivos'}
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    hidden
                    onChange={(e) => handleLocalPhotos(e.target.files)}
                    disabled={uploadingLocal}
                  />
                </label>
                <button className="chip" type="button" onClick={addPhotoField}>Agregar URL</button>
              </div>
            </div>
            <div className="grid grid-2">
              {photos.map((photo, index) => (
                <div key={index} className="card" style={{ padding: 16 }}>
                  {photo.url ? (
                    <div style={{ width: '100%', height: 140, borderRadius: 12, overflow: 'hidden', marginBottom: 12 }}>
                      <img src={photo.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  ) : (
                    <label>
                      URL de la imagen
                      <input
                        value={photo.url}
                        onChange={(e) => updatePhoto(index, { url: e.target.value })}
                        placeholder="https://..."
                      />
                    </label>
                  )}
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
          {form.id && editingAlbum && (
            <div>
              <div className="section-head" style={{ marginBottom: 12 }}>
                <div>
                  <div className="eyebrow">Fotos actuales</div>
                  <h2>Gestiona el album existente</h2>
                </div>
              </div>
              <div className="grid grid-2">
                {(editingAlbum.photos ?? []).length === 0 && <div className="empty-state">Este album aun no tiene fotos.</div>}
                {(editingAlbum.photos ?? []).map((photo, index) => (
                  <div key={photo.id} className="card" style={{ padding: 16 }}>
                    <div className="album-thumb" style={{ marginBottom: 12 }}>
                      <img
                        src={photo.url}
                        alt={photo.fileName || `Foto ${index + 1}`}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 20 }}
                      />
                    </div>
                    <div className="service-actions">
                      <span className="pill">{photo.fileName || `Foto ${index + 1}`}</span>
                      {photo.isCover && <span className="pill">Portada</span>}
                      <button className="chip chip-danger" type="button" onClick={() => handleDeletePhoto(photo.id)}>Eliminar foto</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {error && <div className="auth-error">{error}</div>}
          <div className="form-actions">
            <button className="btn btn-ghost" type="button" onClick={closeForm}>Cancelar</button>
            <button className="btn shine-on-hover press-feedback" type="submit">{form.id ? 'Actualizar album' : 'Guardar album'}</button>
          </div>
        </form>
      </AdminModalForm>

      <MoraScrollReveal as="section" className="grid grid-4" selector=".album-card" variant="fade-up" stagger={0.06} duration={0.55}>
        {albums.map((album, index) => (
          <div
            key={album.id}
            className="card album-card lift-on-hover reveal"
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
            {clientName(album.clientId) && (
              <div className="album-sub">Cliente: {clientName(album.clientId)}</div>
            )}
            <div className="album-sub">{album.description?.trim() || 'Sin descripción.'}</div>
            <div className="service-actions">
              <span className={`pill ${album.privacy === 'PUBLICO' ? 'pill--success' : ''}`}>
                {album.privacy === 'PUBLICO' ? '🌐 Público' : album.privacy}
              </span>
              <button className="chip press-feedback" type="button" onClick={() => handleEdit(album)}>Editar</button>
              <button className="chip chip-danger press-feedback" type="button" onClick={() => handleDelete(album)}>Eliminar</button>
            </div>
          </div>
        ))}
      </MoraScrollReveal>

      <ConfirmDialog
        open={Boolean(confirmDeleteAlbum)}
        title="Eliminar album"
        description={
          confirmDeleteAlbum
            ? `Eliminar el album "${confirmDeleteAlbum.title}"? Esta accion quitara tambien sus fotos.`
            : ''
        }
        confirmLabel="Eliminar"
        variant="danger"
        loading={deleting}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setConfirmDeleteAlbum(null)}
      />

      <ConfirmDialog
        open={confirmDeletePhotoId !== null}
        title="Eliminar foto"
        description="Eliminar esta foto del album? Esta accion no se puede deshacer."
        confirmLabel="Eliminar"
        variant="danger"
        loading={deleting}
        onConfirm={handleDeletePhotoConfirm}
        onCancel={() => setConfirmDeletePhotoId(null)}
      />
    </div>
  );
}
