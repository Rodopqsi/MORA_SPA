"use client";

import { useEffect, useRef, useState } from 'react';
import { staffFetch } from '../../lib/staffApi';

type Service = { id: number; name: string; durationMin: number; priceBase: string; active: boolean };

export default function ServiciosPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [form, setForm] = useState({ name: '', durationMin: 30, priceBase: 0 });
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

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await staffFetch('/services', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name,
          durationMin: Number(form.durationMin),
          priceBase: Number(form.priceBase)
        })
      });
      setForm({ name: '', durationMin: 30, priceBase: 0 });
      loadServices();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
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
          <button className="btn" onClick={() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
            Nuevo servicio
          </button>
        </div>
      </header>

      <section className="card reveal" ref={formRef}>
        <div className="section-head">
          <div>
            <div className="eyebrow">Nuevo servicio</div>
            <h2>Crear servicio</h2>
          </div>
        </div>
        <form className="auth-form" onSubmit={handleCreate}>
          <label>
            Nombre
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </label>
          <label>
            Duracion (min)
            <input
              type="number"
              value={form.durationMin}
              onChange={(e) => setForm({ ...form, durationMin: Number(e.target.value) })}
            />
          </label>
          <label>
            Precio base
            <input
              type="number"
              value={form.priceBase}
              onChange={(e) => setForm({ ...form, priceBase: Number(e.target.value) })}
            />
          </label>
          {error && <div className="auth-error">{error}</div>}
          <button className="btn" type="submit">Guardar</button>
        </form>
      </section>

      <section className="grid grid-2">
        {services.map((service, index) => (
          <div
            key={service.name}
            className="card service-card reveal"
            style={{ animationDelay: `${index * 90}ms` }}
          >
            <div className="service-title">{service.name}</div>
            <div className="service-meta">
              <span className="pill">{service.durationMin} min</span>
              <span className="pill">S/ {service.priceBase}</span>
            </div>
            <div className="service-sub">Estado: {service.active ? 'Activo' : 'Inactivo'}</div>
            <div className="service-actions">
              <button className="chip" onClick={() => toggleActive(service)}>
                {service.active ? 'Desactivar' : 'Activar'}
              </button>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
