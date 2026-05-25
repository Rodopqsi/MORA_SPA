"use client";

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { staffFetch } from '../../lib/staffApi';

const filters = ['Todos', 'Pendiente', 'Confirmado', 'En Proceso', 'Finalizado', 'Cancelado'];

type Staff = { id: number; name: string; role?: string | null };
type Service = { id: number; name: string; durationMin: number; priceBase: string | number };
type ReservationDetail = { id: number; serviceId: number; staffId: number; start: string; end: string };
type Reservation = { id: number; status: string; client?: { name: string }; details: ReservationDetail[] };
type AgendaItem = {
  start: string;
  time: string;
  client: string;
  service: string;
  duration: string;
  price: string;
  tone: string;
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
        setStaff(staffRes.data ?? []);
        setServices(servicesRes.data ?? []);
        setReservations(reservationRes.data ?? []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Error'));
  };

  useEffect(() => {
    loadData();
  }, []);

  const agenda = useMemo(() => {
    const serviceMap = new Map(services.map((service) => [service.id, service]));
    const filtered =
      activeFilter === 'Todos'
        ? reservations
        : reservations.filter((reservation) => statusLabel[reservation.status] === activeFilter);

    return staff.map((member) => {
      const items: AgendaItem[] = [];
      filtered.forEach((reservation) => {
        reservation.details.forEach((detail) => {
          if (detail.staffId !== member.id) return;
          const service = serviceMap.get(detail.serviceId);
          const duration = service?.durationMin ? `${service.durationMin} min` : '-';
          const priceValue = service?.priceBase ? Number(service.priceBase) : 0;
          items.push({
            start: detail.start,
            time: formatTime(detail.start),
            client: reservation.client?.name ?? 'Cliente',
            service: service?.name ?? `Servicio #${detail.serviceId}`,
            duration,
            price: priceValue ? `S/ ${priceValue.toFixed(2)}` : '-',
            tone: statusTone[reservation.status] ?? 'mint'
          });
        });
      });

      items.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

      return {
        id: member.id,
        name: member.name,
        role: member.role ?? 'Equipo',
        items
      };
    });
  }, [activeFilter, reservations, services, staff]);

  const todayLabel = new Date().toLocaleDateString('es-PE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  });

  return (
    <div className="page-stack">
      <header className="page-head">
        <div>
          <div className="eyebrow">Agenda inteligente</div>
          <h1>{todayLabel}</h1>
          <p>Gestion diaria del equipo y reservas.</p>
        </div>
        <div className="page-actions">
          <Link className="chip" href="/agenda">Hoy</Link>
          <Link className="chip" href="/agenda">Semana</Link>
          <Link className="btn btn-outline" href="/reservas">Nueva reserva</Link>
        </div>
      </header>

      <div className="chip-row">
        {filters.map((item) => (
          <button
            key={item}
            className={`chip ${item === activeFilter ? 'chip-active' : ''}`}
            onClick={() => setActiveFilter(item)}
          >
            {item}
          </button>
        ))}
      </div>

      {error && <div className="auth-error">{error}</div>}

      <section className="agenda-board">
        {agenda.map((column) => (
          <div key={column.id} className="agenda-column">
            <div className="agenda-column-head">
              <div className="agenda-name">{column.name}</div>
              <div className="agenda-role">{column.role}</div>
            </div>
            <div className="agenda-column-body">
              {column.items.length === 0 && <div className="list-sub">Sin reservas</div>}
              {column.items.map((item, index) => (
                <div
                  key={`${column.name}-${item.start}`}
                  className={`agenda-card tone-${item.tone} reveal`}
                  style={{ animationDelay: `${index * 120}ms` }}
                >
                  <div className="agenda-time">{item.time}</div>
                  <div className="agenda-client">{item.client}</div>
                  <div className="agenda-service">{item.service}</div>
                  <div className="agenda-meta">{item.duration} / {item.price}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
