"use client";

import { useEffect, useState } from 'react';
import { staffFetch } from '../../lib/staffApi';
import ConfirmDialog from '../../components/ConfirmDialog';
import MoraScrollReveal from '../../components/MoraScrollReveal';
import AdminModalForm from '../../components/AdminModalForm';
import ImageUploader, { type UploaderImage } from '../../components/ImageUploader';

type PromotionType = 'PORCENTAJE' | 'MONTO' | 'REGALO';

type Service = { id: number; name: string };

type PromotionImage = {
  url: string;
  fileName?: string | null;
  source?: 'URL' | 'LOCAL';
  isCover?: boolean;
  cloudinaryPublicId?: string | null;
};

type Promotion = {
  id: number;
  name: string;
  type: PromotionType;
  value?: string | null;
  active: boolean;
  startDate: string;
  endDate: string;
  channel?: string | null;
  serviceIds: number[];
  images?: PromotionImage[];
};

const createEmptyForm = () => ({
  id: null as number | null,
  name: '',
  type: 'PORCENTAJE' as PromotionType,
  value: '',
  startDate: '',
  endDate: '',
  channel: '',
  serviceIds: [] as number[],
  images: [] as UploaderImage[]
});

export default function PromocionesPage() {
  const [promos, setPromos] = useState<Promotion[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [form, setForm] = useState(createEmptyForm());
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<Promotion | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [openForm, setOpenForm] = useState(false);

  const loadPromos = () => {
    Promise.all([
      staffFetch<{ data: Promotion[] }>('/promotions'),
      staffFetch<{ data: Service[] }>('/services')
    ])
      .then(([promoRes, servicesRes]) => {
        setPromos(promoRes.data ?? []);
        setServices(servicesRes.data ?? []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Error'));
  };

  useEffect(() => {
    loadPromos();
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

    try {
      const imagesPayload = form.images
        .filter((img) => img.url.trim().length > 0)
        .map((img) => ({
          url: img.url,
          fileName: img.fileName || undefined,
          source: img.source,
          isCover: img.isCover,
          cloudinaryPublicId: img.publicId
        }));

      await staffFetch(form.id ? `/promotions/${form.id}` : '/promotions', {
        method: form.id ? 'PATCH' : 'POST',
        body: JSON.stringify({
          name: form.name.trim(),
          type: form.type,
          value: form.value.trim() ? Number(form.value) : undefined,
          startDate: form.startDate,
          endDate: form.endDate,
          channel: form.channel.trim() || undefined,
          serviceIds: form.serviceIds,
          images: imagesPayload
        })
      });
      resetForm();
      setOpenForm(false);
      loadPromos();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    }
  };

  const handleEdit = (promo: Promotion) => {
    setForm({
      id: promo.id,
      name: promo.name,
      type: promo.type,
      value: promo.value ? String(promo.value) : '',
      startDate: promo.startDate?.slice(0, 10) ?? '',
      endDate: promo.endDate?.slice(0, 10) ?? '',
      channel: promo.channel ?? '',
      serviceIds: promo.serviceIds ?? [],
      images: (promo.images ?? []).map((img) => ({
        url: img.url,
        fileName: img.fileName ?? undefined,
        source: img.source ?? 'URL',
        isCover: img.isCover ?? false,
        publicId: img.cloudinaryPublicId ?? undefined
      }))
    });
    setOpenForm(true);
  };

  const handleDeleteConfirm = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    setError('');
    try {
      await staffFetch(`/promotions/${confirmDelete.id}`, { method: 'DELETE' });
      if (form.id === confirmDelete.id) {
        resetForm();
      }
      loadPromos();
      setConfirmDelete(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar');
    } finally {
      setDeleting(false);
    }
  };

  const toggleService = (serviceId: number) => {
    setForm((current) => ({
      ...current,
      serviceIds: current.serviceIds.includes(serviceId)
        ? current.serviceIds.filter((id) => id !== serviceId)
        : [...current.serviceIds, serviceId]
    }));
  };

  const toggleActive = async (promo: Promotion) => {
    try {
      await staffFetch(`/promotions/${promo.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ active: !promo.active })
      });
      loadPromos();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al actualizar');
    }
  };

  return (
    <div className="page-stack page-enter">
      <header className="page-head">
        <div>
          <div className="eyebrow">Promociones y beneficios</div>
          <h1>Promociones activas</h1>
          <p>Crea y gestiona descuentos para la tienda y reservas.</p>
        </div>
        <div className="page-actions">
          <button className="btn shine-on-hover press-feedback" onClick={openCreate}>
            + Añadir
          </button>
        </div>
      </header>

      <AdminModalForm
        open={openForm}
        onClose={closeForm}
        eyebrow={form.id ? 'Editar promocion' : 'Nueva promocion'}
        title={form.id ? 'Actualizar promocion' : 'Crear promocion'}
      >
        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            Nombre
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </label>
          <label>
            Tipo
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as PromotionType })}>
              <option value="PORCENTAJE">PORCENTAJE</option>
              <option value="MONTO">MONTO</option>
              <option value="REGALO">REGALO</option>
            </select>
          </label>
          <label>
            Valor
            <input type="number" min="0" step="0.01" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} />
          </label>
          <label>
            Inicio
            <input required type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
          </label>
          <label>
            Fin
            <input required type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
          </label>
          <label>
            Canal
            <input value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })} placeholder="Whatsapp, Instagram, Web..." />
          </label>
          <div>
            <ImageUploader
              bucket="misc"
              value={form.images}
              onChange={(images) => setForm({ ...form, images })}
              maxFiles={4}
              label="Imagenes de la promocion"
            />
          </div>
          <div>
            <div className="section-head" style={{ marginBottom: 12 }}>
              <div>
                <div className="eyebrow">Servicios aplicables</div>
                <h2>Define el alcance</h2>
              </div>
            </div>
            <div className="chip-row">
              {services.map((service) => (
                <label key={service.id} className="chip press-feedback">
                  <input
                    type="checkbox"
                    checked={form.serviceIds.includes(service.id)}
                    onChange={() => toggleService(service.id)}
                  />
                  {service.name}
                </label>
              ))}
            </div>
          </div>
          {error && <div className="auth-error">{error}</div>}
          <div className="form-actions">
            <button className="btn btn-ghost" type="button" onClick={closeForm}>Cancelar</button>
            <button className="btn shine-on-hover press-feedback" type="submit">{form.id ? 'Actualizar' : 'Guardar'}</button>
          </div>
        </form>
      </AdminModalForm>

      <MoraScrollReveal as="section" className="grid grid-3" selector=".promo-card" variant="fade-up" stagger={0.07} duration={0.6}>
        {promos.map((promo, index) => (
          <div
            key={promo.id}
            className="card promo-card lift-on-hover reveal"
            style={{ animationDelay: `${index * 90}ms` }}
          >
            <div className="card-head-row">
              <h3>{promo.name}</h3>
              <span className={`status-pill ${promo.active ? 'status-on' : 'status-off'}`}>
                {promo.active ? 'Activa' : 'Inactiva'}
              </span>
            </div>
            <p>Tipo {promo.type}{promo.value ? ` · ${promo.value}` : ''}</p>
            <div className="promo-date">Canal: {promo.channel || 'General'}</div>
            <div className="promo-date">{promo.startDate?.slice(0, 10)} - {promo.endDate?.slice(0, 10)}</div>
            <div className="chip-row">
              {services
                .filter((service) => promo.serviceIds?.includes(service.id))
                .map((service) => <span key={service.id} className="pill">{service.name}</span>)}
            </div>
            <div className="service-actions">
              <button className="chip press-feedback" onClick={() => handleEdit(promo)}>Editar</button>
              <button className="chip press-feedback" onClick={() => toggleActive(promo)}>
                {promo.active ? 'Desactivar' : 'Activar'}
              </button>
              <button className="chip chip-danger press-feedback" onClick={() => setConfirmDelete(promo)}>Eliminar</button>
            </div>
          </div>
        ))}
      </MoraScrollReveal>

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        title="Eliminar promocion"
        description={
          confirmDelete
            ? `Eliminar "${confirmDelete.name}"? Quedara archivada cómo inactiva.`
            : ''
        }
        confirmLabel="Eliminar"
        variant="danger"
        loading={deleting}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
