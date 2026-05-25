"use client";

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { staffFetch } from '../../lib/staffApi';

type Upcoming = {
  id: number;
  start: string;
  status: string;
  client: { name: string };
  details: { service?: { name: string } | null; staff?: { name: string } | null }[];
};

type Summary = {
  reservationCount: number;
  revenue: number;
  advances: number;
  staffOnDuty: number;
  upcoming: Upcoming[];
};

export default function DashboardPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    staffFetch<{ data: Summary }>('/metrics/summary')
      .then((res) => setSummary(res.data))
      .catch((err) => setError(err instanceof Error ? err.message : 'Error'));
  }, []);

  const stats = [
    { label: 'Reservas del dia', value: summary?.reservationCount ?? 0, meta: 'Agenda diaria', tone: 'rose' },
    { label: 'Ingresos del dia', value: `S/ ${summary?.revenue ?? 0}`, meta: 'Pagos confirmados', tone: 'sun' },
    { label: 'Pagos adelantados', value: `S/ ${summary?.advances ?? 0}`, meta: 'Adelantos del dia', tone: 'mint' },
    { label: 'Personal en turno', value: summary?.staffOnDuty ?? 0, meta: 'Disponibilidad en vivo', tone: 'plum' }
  ];

  const upcoming = summary?.upcoming ?? [];

  return (
    <div className="page-stack">
      <section className="grid grid-4">
        {stats.map((stat, index) => (
          <div
            key={stat.label}
            className={`card stat-card reveal tone-${stat.tone}`}
            style={{ animationDelay: `${index * 80}ms` }}
          >
            <div className="stat-label">{stat.label}</div>
            <div className="stat-value">{stat.value}</div>
            <div className="stat-meta">{stat.meta}</div>
          </div>
        ))}
      </section>

      {error && <div className="card">{error}</div>}

      <section className="grid grid-2">
        <div className="card reveal">
          <div className="section-head">
            <div>
              <div className="eyebrow">Proximas citas</div>
              <h2>Confirma o reagenda con un toque</h2>
            </div>
            <Link className="chip" href="/agenda">Ver agenda completa</Link>
          </div>
          <div className="list">
            {upcoming.length === 0 && <div className="list-item">No hay citas cercanas.</div>}
            {upcoming.map((item) => (
              <div key={item.id} className="list-item">
                <div className="list-time">{new Date(item.start).toLocaleTimeString()}</div>
                <div className="list-main">
                  <div className="list-title">{item.client?.name ?? 'Cliente'}</div>
                  <div className="list-sub">
                    {(item.details[0]?.service?.name ?? 'Servicio')} / {item.details[0]?.staff?.name ?? 'Especialista'}
                  </div>
                </div>
                <div className="list-meta">
                  <div className="price-tag">{item.details.length} servicio(s)</div>
                  <span className={`status-badge ${item.status === 'CONFIRMADA' ? 'status-ok' : 'status-warn'}`}>
                    {item.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card reveal">
          <div className="section-head">
            <div>
              <div className="eyebrow">Equipo de hoy</div>
              <h2>Disponibilidad en tiempo real</h2>
            </div>
            <Link className="chip" href="/equipo">Ver equipo completo</Link>
          </div>
          <div className="list">
            <div className="list-item">
              <div className="avatar">EQ</div>
              <div className="list-main">
                <div className="list-title">Personal activo</div>
                <div className="list-sub">Equipo en turno hoy</div>
              </div>
              <div className="pill">{summary?.staffOnDuty ?? 0} personas</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
