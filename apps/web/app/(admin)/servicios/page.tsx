"use client";

import { useEffect, useState } from 'react';
import { staffFetch } from '../../lib/staffApi';
import { resolveUploadUrl } from '../../lib/api';
import ImageUploader, { type UploaderImage } from '../../components/ImageUploader';
import MoraScrollReveal from '../../components/MoraScrollReveal';
import ConfirmDialog from '../../components/ConfirmDialog';
import AdminModalForm from '../../components/AdminModalForm';

type Service = {
  id: number;
  name: string;
  description?: string | null;
  durationMin: number;
  priceBase: string;
  active: boolean;
  coverUrl?: string | null;
  images?: UploaderImage[];
};

type ServiceForm = {
  id: number | null;
  name: string;
  description: string;
  durationMin: number;
  priceBase: number;
  active: boolean;
  coverUrl: string;
  images: UploaderImage[];
};

const createEmptyForm = (): ServiceForm => ({
  id: null,
  name: '',
  description: '',
  durationMin: 30,
  priceBase: 0,
  active: true,
  coverUrl: '',
  images: []
});

const normalizeServiceImages = (service: Service): UploaderImage[] => {
  if (!service.images || service.images.length === 0) return [];
  return service.images.map((img) => ({
    url: resolveUploadUrl(img.url),
    fileName: img.fileName,
    source: img.source,
    isCover: img.isCover
  }));
};

const ensureCover = (images: UploaderImage[]): UploaderImage[] => {
  const cleaned = images.filter((i) => i.url.trim().length > 0);
  if (cleaned.length === 0) return [];
  const coverIndex = cleaned.findIndex((i) => i.isCover);
  return cleaned.map((i, idx) => ({
    ...i,
    isCover: coverIndex === -1 ? idx === 0 : idx === coverIndex
  }));
};

const serviceCover = (service: Service): string | null => {
  if (service.coverUrl) return resolveUploadUrl(service.coverUrl);
  const images = service.images ?? [];
  const cover = images.find((i) => i.isCover);
  if (cover) return resolveUploadUrl(cover.url);
  return resolveUploadUrl(images[0]?.url);
};

export default function ServiciosPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [form, setForm] = useState<ServiceForm>(createEmptyForm());
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Service | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [openForm, setOpenForm] = useState(false);

  const loadServices = () => {
    staffFetch<{ data: Service[] }>('/services')
      .then((res) => setServices(res.data ?? []))
      .catch((err) => setError(err instanceof Error ? err.message : 'Error'));
  };

  useEffect(() => {
    loadServices();
  }, []);

  const resetForm = () => {
    setForm(createEmptyForm());
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
    setSaving(true);

    try {
      const normalized = ensureCover(form.images);
      const cover = normalized.find((i) => i.isCover);
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        durationMin: Number(form.durationMin),
        priceBase: Number(form.priceBase),
        active: form.active,
        coverUrl: form.coverUrl.trim() || cover?.url || undefined,
        images: normalized.map((img) => ({
          url: img.url,
          fileName: img.fileName,
          source: img.source,
          isCover: img.isCover,
          cloudinaryPublicId: img.publicId
        }))
      };

      await staffFetch(form.id ? `/services/${form.id}` : '/services', {
        method: form.id ? 'PATCH' : 'POST',
        body: JSON.stringify(payload)
      });
      resetForm();
      setOpenForm(false);
      loadServices();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (service: Service) => {
    setForm({
      id: service.id,
      name: service.name,
      description: service.description ?? '',
      durationMin: service.durationMin,
      priceBase: Number(service.priceBase),
      active: service.active,
      coverUrl: service.coverUrl ?? '',
      images: normalizeServiceImages(service)
    });
    setOpenForm(true);
  };

  const handleDeleteConfirm = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    setError('');
    try {
      await staffFetch(`/services/${confirmDelete.id}`, { method: 'DELETE' });
      if (form.id === confirmDelete.id) {
        resetForm();
      }
      loadServices();
      setConfirmDelete(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar');
    } finally {
      setDeleting(false);
    }
  };

  const toggleActive = async (service: Service) => {
    setError('');
    try {
      await staffFetch(`/services/${service.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ active: !service.active })
      });
      loadServices();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al actualizar');
    }
  };

  return (
    <div className="page-stack page-enter">
      <header className="page-head">
        <div>
          <div className="eyebrow">Catalogo de servicios</div>
          <h1>Servicios del salon</h1>
          <p>Duraciones, precios y especialistas asignados.</p>
        </div>
        <div className="page-actions">
          <button
            className="btn btn-primary shine-on-hover press-feedback"
            onClick={openCreate}
          >
            + Añadir
          </button>
        </div>
      </header>

      <AdminModalForm
        open={openForm}
        onClose={closeForm}
        eyebrow={form.id ? 'Editar servicio' : 'Nuevo servicio'}
        title={form.id ? 'Actualizar servicio' : 'Crear servicio'}
      >
        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="form-row-2">
            <label>
              Nombre
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Corte y diseño canino"
              />
            </label>
            <label>
              Estado
              <select
                value={form.active ? '1' : '0'}
                onChange={(e) => setForm({ ...form, active: e.target.value === '1' })}
              >
                <option value="1">Activo</option>
                <option value="0">Inactivo</option>
              </select>
            </label>
          </div>
          <label>
            Descripción
            <textarea
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Describe el servicio, beneficios o alcance."
            />
          </label>
          <div className="form-row-2">
            <label>
              Duracion (min)
              <input
                type="number"
                min="1"
                value={form.durationMin}
                onChange={(e) => setForm({ ...form, durationMin: Number(e.target.value) })}
              />
            </label>
            <label>
              Precio base (S/)
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.priceBase}
                onChange={(e) => setForm({ ...form, priceBase: Number(e.target.value) })}
              />
            </label>
          </div>

          <div className="form-section">
            <ImageUploader
              bucket="services"
              value={form.images}
              onChange={(images) => setForm({ ...form, images })}
              maxFiles={8}
              label="Imágenes del servicio (max 8)"
            />
            <p className="form-hint">
              La primera imagen marcada cómo <strong>portada</strong> se mostrara en el catalogo público.
            </p>
          </div>

          {error && <div className="auth-error">{error}</div>}
          <div className="form-actions">
            <button className="btn btn-ghost" type="button" onClick={closeForm}>
              Cancelar
            </button>
            <button className="btn btn-primary shine-on-hover press-feedback" type="submit" disabled={saving}>
              {saving ? 'Guardando...' : form.id ? 'Actualizar servicio' : 'Guardar servicio'}
            </button>
          </div>
        </form>
      </AdminModalForm>

      <MoraScrollReveal as="section" className="showcase-evolution-grid" selector=".premium-service-box" variant="fade-up" stagger={0.08} duration={0.6}>
        {services.length === 0 && (
          <div className="premium-service-box" style={{ justifyContent: 'center', alignItems: 'center', padding: '48px', textAlign: 'center' }}>
            <div className="empty-state-icon">SR</div>
            <h3>Aún no hay servicios</h3>
            <p>Empieza creando el primero con el botón de arriba.</p>
          </div>
        )}
        {services.map((service, index) => {
          const cover = serviceCover(service);
          return (
            <div
              key={service.id}
              className="premium-service-box lift-on-hover reveal"
              style={{ animationDelay: `${index * 90}ms` }}
            >
              <div className="service-box-visual">
                {cover ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={cover} alt={service.name} />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #fde6ef 0%, #f9d9e6 100%)', color: 'var(--accent-dark)', fontWeight: 700, fontSize: '14px' }}>
                    {service.name.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="service-box-overlay">
                  <span className="service-box-tag">{service.durationMin} min</span>
                </div>
              </div>
              <div className="service-box-content">
                <div className="service-box-header">
                  <h3>{service.name}</h3>
                  <span className="service-box-price">S/ {service.priceBase}</span>
                </div>
                <p className="service-box-text">
                  {service.description?.trim() || 'Sin descripción registrada.'}
                </p>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <span className={`status-pill ${service.active ? 'status-on' : 'status-off'}`}>
                    {service.active ? 'Activo' : 'Inactivo'}
                  </span>
                  {service.images && service.images.length > 1 && (
                    <span className="pill pill-soft">+{service.images.length - 1} fotos</span>
                  )}
                </div>
                <div className="service-actions" style={{ marginTop: 'auto', paddingTop: '4px' }}>
                  <button className="chip press-feedback" onClick={() => handleEdit(service)}>
                    Editar
                  </button>
                  <button className="chip press-feedback" onClick={() => toggleActive(service)}>
                    {service.active ? 'Desactivar' : 'Activar'}
                  </button>
                  <button className="chip chip-danger press-feedback" onClick={() => setConfirmDelete(service)}>
                    Eliminar
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </MoraScrollReveal>

      <ConfirmDialog
        open={!!confirmDelete}
        title="Eliminar servicio"
        description={`Eliminar "${confirmDelete?.name}"? Quedara archivado cómo inactivo y no será visible al cliente.`}
        confirmLabel="Eliminar"
        variant="danger"
        loading={deleting}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
