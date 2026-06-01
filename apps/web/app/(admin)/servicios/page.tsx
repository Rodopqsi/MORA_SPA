"use client";

import { useEffect, useRef, useState } from 'react';
import { staffFetch } from '../../lib/staffApi';

type Service = {
  id: number;
  name: string;
  description?: string | null;
  durationMin: number;
  priceBase: string;
  active: boolean;
};

const createEmptyForm = () => ({
  id: null as number | null,
  name: '',
  description: '',
  durationMin: 30,
  priceBase: 0
});

export default function ServiciosPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [form, setForm] = useState(createEmptyForm());
  const [error, setError] = useState('');
  const formRef = useRef<HTMLDivElement>(null);

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

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    try {
      await staffFetch(form.id ? `/services/${form.id}` : '/services', {
        method: form.id ? 'PATCH' : 'POST',
        body: JSON.stringify({
          name: form.name.trim(),
          description: form.description.trim() || undefined,
          durationMin: Number(form.durationMin),
          priceBase: Number(form.priceBase)
        })
      });
      resetForm();
      loadServices();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    }
  };

  const handleEdit = (service: Service) => {
    setForm({
      id: service.id,
      name: service.name,
      description: service.description ?? '',
      durationMin: service.durationMin,
      priceBase: Number(service.priceBase)
    });
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleDelete = async (service: Service) => {
    const confirmed = window.confirm(`Eliminar ${service.name}? Quedara archivado como inactivo.`);
    if (!confirmed) return;

    setError('');
    try {
      await staffFetch(`/services/${service.id}`, { method: 'DELETE' });
      if (form.id === service.id) {
        resetForm();
      }
      loadServices();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar');
    }
  };

  const toggleActive = async (service: Service) => {
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
    <div className="page-stack">
      <header className="page-head">
        <div>
          <div className="eyebrow">Catalogo de servicios</div>
          <h1>Servicios que enamoran</h1>
          <p>Duraciones, costos y especialistas alineados con tu agenda.</p>
        </div>
        <div className="page-actions">
          <button className="btn" onClick={() => {
            resetForm();
            formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }}>
            Nuevo servicio
          </button>
        </div>
      </header>

      <section className="card reveal" ref={formRef}>
        <div className="section-head">
          <div>
            <div className="eyebrow">{form.id ? 'Editar servicio' : 'Nuevo servicio'}</div>
            <h2>{form.id ? 'Actualizar servicio' : 'Crear servicio'}</h2>
          </div>
          <button className="chip" type="button" onClick={resetForm}>Limpiar</button>
        </div>
        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            Nombre
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </label>
          <label>
            Descripcion
            <textarea
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Describe el servicio, beneficios o alcance."
            />
          </label>
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
            Precio base
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.priceBase}
              onChange={(e) => setForm({ ...form, priceBase: Number(e.target.value) })}
            />
          </label>
          {error && <div className="auth-error">{error}</div>}
          <button className="btn" type="submit">{form.id ? 'Actualizar' : 'Guardar'}</button>
        </form>
      </section>

      <section className="grid grid-2">
        {services.map((service, index) => (
          <div
            key={service.id}
            className="card service-card reveal"
            style={{ animationDelay: `${index * 90}ms` }}
          >
            <div className="service-title">{service.name}</div>
            <p>{service.description?.trim() || 'Sin descripcion registrada.'}</p>
            <div className="service-meta">
              <span className="pill">{service.durationMin} min</span>
              <span className="pill">S/ {service.priceBase}</span>
            </div>
            <div className="service-sub">Estado: {service.active ? 'Activo' : 'Inactivo'}</div>
            <div className="service-actions">
              <button className="chip" onClick={() => handleEdit(service)}>
                Editar
              </button>
              <button className="chip" onClick={() => toggleActive(service)}>
                {service.active ? 'Desactivar' : 'Activar'}
              </button>
              <button className="chip" onClick={() => handleDelete(service)}>
                Eliminar
              </button>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
