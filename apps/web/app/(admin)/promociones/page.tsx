"use client";

import { useEffect, useState } from 'react';
import { staffFetch } from '../../lib/staffApi';

type Promotion = { id: number; name: string; type: string; active: boolean; startDate: string; endDate: string };

export default function PromocionesPage() {
  const [promos, setPromos] = useState<Promotion[]>([]);
  const [form, setForm] = useState({ name: '', type: 'PORCENTAJE', value: 0, startDate: '', endDate: '' });
  const [error, setError] = useState('');

  const loadPromos = () => {
    staffFetch<{ data: Promotion[] }>('/promotions')
      .then((res) => setPromos(res.data ?? []))
      .catch((err) => setError(err instanceof Error ? err.message : 'Error'));
  };

  useEffect(() => {
    loadPromos();
  }, []);

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await staffFetch('/promotions', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name,
          type: form.type,
          value: Number(form.value),
          startDate: form.startDate,
          endDate: form.endDate
        })
      });
      setForm({ name: '', type: 'PORCENTAJE', value: 0, startDate: '', endDate: '' });
      loadPromos();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    }
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
          <button className="btn">Nueva promocion</button>
        </div>
      </header>

      <section className="card reveal">
        <div className="section-head">
          <div>
            <div className="eyebrow">Nueva promocion</div>
            <h2>Crear promocion</h2>
          </div>
        </div>
        <form className="auth-form" onSubmit={handleCreate}>
          <label>
            Nombre
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </label>
          <label>
            Tipo
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <option value="PORCENTAJE">PORCENTAJE</option>
              <option value="MONTO">MONTO</option>
              <option value="REGALO">REGALO</option>
            </select>
          </label>
          <label>
            Valor
            <input type="number" value={form.value} onChange={(e) => setForm({ ...form, value: Number(e.target.value) })} />
          </label>
          <label>
            Inicio
            <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
          </label>
          <label>
            Fin
            <input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
          </label>
          {error && <div className="auth-error">{error}</div>}
          <button className="btn" type="submit">Guardar</button>
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
            <p>Tipo {promo.type}</p>
            <div className="promo-date">{promo.startDate?.slice(0, 10)} - {promo.endDate?.slice(0, 10)}</div>
            <button className="chip" onClick={() => toggleActive(promo)}>
              {promo.active ? 'Desactivar' : 'Activar'}
            </button>
          </div>
        ))}
      </section>
    </div>
  );
}
