"use client";

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { staffFetch } from '../../lib/staffApi';
import MoraScrollReveal from '../../components/MoraScrollReveal';

const filters = ['Todos', 'Pendiente', 'Confirmado', 'En Proceso', 'Finalizado', 'Cancelado'];

type Staff = { id: number; name: string; role?: string | null };
type Service = { id: number; name: string; durationMin: number; priceBase: string | number };
type ReservationDetail = { id: number; serviceId: number; staffId: number; start: string; end: string };
type Reservation = { id: number; status: string; client?: { name: string }; details: ReservationDetail[] };

type AgendaItem = {
  key: string;
  start: string;
  time: string;
  client: string;
  service: string;
  duration: string;
  price: string;
  tone: string;
};

type AgendaColumn = {
  id: number;
  name: string;
  role: string;
  items: AgendaItem[];
};

const statusLabel: Record<string, string> = {
  PENDIENTE_ADELANTO: 'Pendiente',
  CONFIRMADA: 'Confirmado',
  EN_PROCESO: 'En Proceso',
  ATENDIDA: 'Finalizado',
  CANCELADA: 'Cancelado'
};

const statusTone: Record<string, string> = {
  PENDIENTE_ADELANTO: 'rose',
  CONFIRMADA: 'mint',
  EN_PROCESO: 'sun',
  ATENDIDA: 'plum',
  CANCELADA: 'rose'
};

const formatTime = (value: string) =>
  new Date(value).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });

const buildColumns = (
  staff: Staff[],
  services: Service[],
  reservations: Reservation[],
  activeFilter: string
): AgendaColumn[] => {
  const serviceMap = new Map<number, Service>();
  for (const service of services) {
    serviceMap.set(service.id, service);
  }

  const filtered = reservations.filter(
    (reservation) => activeFilter === 'Todos' || statusLabel[reservation.status] === activeFilter
  );

  const columns: AgendaColumn[] = [];

  for (const member of staff) {
    const items: AgendaItem[] = [];
    for (const reservation of filtered) {
      for (const detail of reservation.details) {
        if (detail.staffId !== member.id) continue;
        const service = serviceMap.get(detail.serviceId);
        const duration = service && service.durationMin ? service.durationMin + ' min' : '-';
        const priceValue = service && service.priceBase ? Number(service.priceBase) : 0;
        const detailPart = detail.id != null ? 'd' + detail.id : 's' + detail.serviceId + 't' + detail.start;
        const cardKey = 'm' + member.id + '-r' + reservation.id + '-' + detailPart;
        items.push({
          key: cardKey,
          start: detail.start,
          time: formatTime(detail.start),
          client: reservation.client ? reservation.client.name : 'Cliente',
          service: service ? service.name : 'Servicio #' + detail.serviceId,
          duration,
          price: priceValue ? 'S/ ' + priceValue.toFixed(2) : '-',
          tone: statusTone[reservation.status] ? statusTone[reservation.status] : 'mint'
        });
      }
    }
    items.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
    columns.push({
      id: member.id,
      name: member.name,
      role: member.role ? member.role : 'Equipo',
      items
    });
  }

  return columns;
};

export default function AgendaPage() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [activeFilter, setActiveFilter] = useState(filters[0]);
  const [error, setError] = useState('');

  const loadData = () => {
    Promise.all([
      staffFetch<{ data: Staff[] }>('/staff'),
      staffFetch<{ data: Service[] }>('/services'),
      staffFetch<{ data: Reservation[] }>('/reservations')
    ])
      .then(([staffRes, servicesRes, reservationRes]) => {
        setStaff(staffRes.data || []);
        setServices(servicesRes.data || []);
        setReservations(reservationRes.data || []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Error'));
  };

  useEffect(() => {
    loadData();
  }, []);

  const agenda = useMemo(
    () => buildColumns(staff, services, reservations, activeFilter),
    [staff, services, reservations, activeFilter]
  );

  const todayLabel = new Date().toLocaleDateString('es-PE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  });

  return (
    <div className="page-stack page-enter">
      <header className="page-head">
        <div>
          <div className="eyebrow">Agenda</div>
          <h1>{todayLabel}</h1>
          <p></p>
        </div>
        <div className="page-actions">
          <Link className="btn btn-outline press-feedback" href="/reservas">Nueva reserva</Link>
        </div>
      </header>

      <MoraScrollReveal as="div" className="chip-row" selector=".chip" variant="fade-up" stagger={0.04} duration={0.4}>
        {filters.map((item) => (
          <button
            key={item}
            className={'chip press-feedback ' + (item === activeFilter ? 'chip-active' : '')}
            onClick={() => setActiveFilter(item)}
          >
            {item}
          </button>
        ))}
      </MoraScrollReveal>

      {error && <div className="auth-error">{error}</div>}

      <section className="agenda-board">
        {agenda.map((column) => (
          <div key={column.id} className="agenda-column">
            <div className="agenda-column-head">
              <div className="agenda-name">{column.name}</div>
              <div className="agenda-role">{column.role}</div>
            </div>
            <MoraScrollReveal as="div" className="agenda-column-body" selector=".agenda-card" variant="fade-up" stagger={0.05} duration={0.45}>
              {column.items.length === 0 && (
                <div className="agenda-empty">
                  <span className="agenda-empty-mark">—</span>
                  Sin reservas para este filtro
                </div>
              )}
              {column.items.map((item, index) => (
                <div
                  key={item.key}
                  className={'agenda-card tone-' + item.tone + ' lift-on-hover reveal'}
                  style={{ animationDelay: index * 120 + 'ms' }}
                >
                  <div className="agenda-time">{item.time}</div>
                  <div className="agenda-client">{item.client}</div>
                  <div className="agenda-service">{item.service}</div>
                  <div className="agenda-meta">
                    <span className="agenda-meta-duration">{item.duration}</span>
                    <span className="agenda-meta-price">{item.price}</span>
                  </div>
                </div>
              ))}
            </MoraScrollReveal>
          </div>
        ))}
      </section>
    </div>
  );
}
