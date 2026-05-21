"use client";

import { useEffect, useMemo, useState } from 'react';
import { staffFetch } from '../../lib/staffApi';

type Reservation = {
  id: number;
  start: string;
  status: string;
  client: { name: string; phone: string };
  details: { serviceId: number; staffId: number | null }[];
};

type Service = { id: number; name: string; durationMin: number };
type Staff = { id: number; name: string };

const statusOptions = ['PENDIENTE_ADELANTO', 'CONFIRMADA', 'EN_PROCESO', 'ATENDIDA', 'CANCELADA', 'NO_SHOW', 'VENCIDA'];

export default function ReservasPage() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [status, setStatus] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      staffFetch<{ data: Service[] }>('/services'),
      staffFetch<{ data: Staff[] }>('/staff')
    ])
      .then(([servicesRes, staffRes]) => {
        setServices(servicesRes.data ?? []);
        setStaff(staffRes.data ?? []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Error'));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (date) {
      params.set('from', date);
      params.set('to', date);
    }
    staffFetch<{ data: Reservation[] }>(`/reservations?${params.toString()}`)
      .then((res) => setReservations(res.data ?? []))
      .catch((err) => setError(err instanceof Error ? err.message : 'Error'));
  }, [status, date]);

  const serviceMap = useMemo(() => new Map(services.map((service) => [service.id, service])), [services]);
  const staffMap = useMemo(() => new Map(staff.map((item) => [item.id, item])), [staff]);

  const updateStatus = async (id: number, nextStatus: string) => {
    try {
      await staffFetch(`/reservations/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus })
      });
      setReservations((prev) => prev.map((item) => (item.id === id ? { ...item, status: nextStatus } : item)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al actualizar');
    }
  };

  return (
    <div className="page-stack">
      <header className="page-head">
        <div>
          <div className="eyebrow">Gestion de reservas</div>
          <h1>Reservas del dia</h1>
          <p>11 citas - Minimo 10 min antes - Duracion 20 min a 4 horas</p>
        </div>
        <div className="page-actions">
          <button className="btn">Nueva reserva</button>
        </div>
      </header>

      <div className="toolbar">
        <div className="search wide">
          <span className="search-dot" />
          <input placeholder="Buscar cliente o servicio" />
        </div>
        <div className="chip-row">
          <input
            type="date"
            className="chip"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
          <select className="chip" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">Todos</option>
            {statusOptions.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </div>
      </div>

      {error && <div className="card">{error}</div>}

      <section className="card table-card reveal">
        <div className="table-head">
          <div>Hora</div>
          <div>Cliente</div>
          <div>Servicio</div>
          <div>Especialista</div>
          <div>Pago</div>
          <div>Estado</div>
          <div>Acciones</div>
        </div>
        <div className="table-body">
          {reservations.length === 0 && <div className="table-row">Sin reservas para esta fecha.</div>}
          {reservations.map((item) => {
            const detail = item.details[0];
            const service = detail ? serviceMap.get(detail.serviceId) : null;
            const staffName = detail?.staffId ? staffMap.get(detail.staffId)?.name : 'Sin asignar';
            return (
              <div key={item.id} className="table-row">
                <div>
                  <div className="table-title">{new Date(item.start).toLocaleTimeString()}</div>
                  <div className="table-sub">{service?.durationMin ?? '-'} min</div>
                </div>
                <div>
                  <div className="table-title">{item.client?.name ?? 'Cliente'}</div>
                  <div className="table-sub">{item.client?.phone ?? '-'}</div>
                </div>
                <div>
                  <div className="table-title">{service?.name ?? 'Servicio'}</div>
                  <div className="table-sub">Detalle interno</div>
                </div>
                <div className="table-sub">{staffName ?? '-'}</div>
                <div className="table-title">Pendiente</div>
                <div>
                  <select
                    className="chip"
                    value={item.status}
                    onChange={(event) => updateStatus(item.id, event.target.value)}
                  >
                    {statusOptions.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </div>
                <div className="table-actions">
                  <button className="icon-btn">OK</button>
                  <button className="icon-btn">ED</button>
                  <button className="icon-btn danger">X</button>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
