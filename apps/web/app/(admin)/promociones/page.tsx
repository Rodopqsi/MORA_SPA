"use client";

import { useEffect, useRef, useState } from 'react';
import { staffFetch } from '../../lib/staffApi';

type PromotionType = 'PORCENTAJE' | 'MONTO' | 'REGALO';

type Service = { id: number; name: string };

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
};

const createEmptyForm = () => ({
  id: null as number | null,
  name: '',
  type: 'PORCENTAJE' as PromotionType,
  value: '',
  startDate: '',
  endDate: '',
  channel: '',
  serviceIds: [] as number[]
});

export default function PromocionesPage() {
  const [promos, setPromos] = useState<Promotion[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [form, setForm] = useState(createEmptyForm());
  const [error, setError] = useState('');
  const formRef = useRef<HTMLDivElement>(null);

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

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    try {
      await staffFetch(form.id ? `/promotions/${form.id}` : '/promotions', {
        method: form.id ? 'PATCH' : 'POST',
        body: JSON.stringify({
          name: form.name.trim(),
          type: form.type,
          value: form.value.trim() ? Number(form.value) : undefined,
          startDate: form.startDate,
          endDate: form.endDate,
          channel: form.channel.trim() || undefined,
          serviceIds: form.serviceIds
        })
      });
      resetForm();
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
      serviceIds: promo.serviceIds ?? []
    });
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleDelete = async (promo: Promotion) => {
    const confirmed = window.confirm(`Eliminar ${promo.name}? Quedara archivada como inactiva.`);
    if (!confirmed) return;

    setError('');
    try {
      await staffFetch(`/promotions/${promo.id}`, { method: 'DELETE' });
      if (form.id === promo.id) {
        resetForm();
      }
      loadPromos();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar');
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
    <div className="page-stack">
      <header className="page-head">
        <div>
          <div className="eyebrow">Promociones y beneficios</div>
          <h1>Campanas que atraen</h1>
          <p>Planifica promociones y descuentos con impacto real.</p>
        </div>
        <div className="page-actions">
          <button className="btn" onClick={() => {
            resetForm();
            formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }}>
            Nueva promocion
          </button>
        </div>
      </header>

      <section className="card reveal" ref={formRef}>
        <div className="section-head">
          <div>
            <div className="eyebrow">{form.id ? 'Editar promocion' : 'Nueva promocion'}</div>
            <h2>{form.id ? 'Actualizar promocion' : 'Crear promocion'}</h2>
          </div>
          <button className="chip" type="button" onClick={resetForm}>Limpiar</button>
        </div>
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
            <div className="section-head" style={{ marginBottom: 12 }}>
              <div>
                <div className="eyebrow">Servicios aplicables</div>
                <h2>Define el alcance</h2>
              </div>
            </div>
            <div className="chip-row">
              {services.map((service) => (
                <label key={service.id} className="chip">
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
          <button className="btn" type="submit">{form.id ? 'Actualizar' : 'Guardar'}</button>
        </form>
      </section>

      <section className="grid grid-3">
        {promos.map((promo, index) => (
          <div
            key={promo.id}
            className="card promo-card reveal"
            style={{ animationDelay: `${index * 90}ms` }}
          >
            <div className="promo-tag">{promo.active ? 'Activa' : 'Inactiva'}</div>
            <h3>{promo.name}</h3>
            <p>Tipo {promo.type}{promo.value ? ` · ${promo.value}` : ''}</p>
            <div className="promo-date">Canal: {promo.channel || 'General'}</div>
            <div className="promo-date">{promo.startDate?.slice(0, 10)} - {promo.endDate?.slice(0, 10)}</div>
            <div className="chip-row">
              {services
                .filter((service) => promo.serviceIds?.includes(service.id))
                .map((service) => <span key={service.id} className="pill">{service.name}</span>)}
            </div>
            <div className="service-actions">
              <button className="chip" onClick={() => handleEdit(promo)}>Editar</button>
              <button className="chip" onClick={() => toggleActive(promo)}>
                {promo.active ? 'Desactivar' : 'Activar'}
              </button>
              <button className="chip" onClick={() => handleDelete(promo)}>Eliminar</button>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
