"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
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
type Client = { id: number; name: string; phone: string };

const statusOptions = ['PENDIENTE_ADELANTO', 'CONFIRMADA', 'EN_PROCESO', 'ATENDIDA', 'CANCELADA', 'NO_SHOW', 'VENCIDA'];

const statusLabels: Record<string, string> = {
  PENDIENTE_ADELANTO: 'Pendiente',
  CONFIRMADA: 'Confirmada',
  EN_PROCESO: 'En proceso',
  ATENDIDA: 'Atendida',
  CANCELADA: 'Cancelada',
  NO_SHOW: 'No show',
  VENCIDA: 'Vencida'
};

export default function ReservasPage() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [status, setStatus] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [query, setQuery] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ clientId: '', serviceId: '', staffId: '', start: '' });
  const [error, setError] = useState('');
  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    Promise.all([
      staffFetch<{ data: Service[] }>('/services'),
      staffFetch<{ data: Staff[] }>('/staff'),
      staffFetch<{ data: Client[] }>('/clients')
    ])
      .then(([servicesRes, staffRes, clientsRes]) => {
        setServices(servicesRes.data ?? []);
        setStaff(staffRes.data ?? []);
        setClients(clientsRes.data ?? []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Error'));
  }, []);

  const loadReservations = () => {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (date) {
      params.set('from', date);
      params.set('to', date);
    }
    staffFetch<{ data: Reservation[] }>(`/reservations?${params.toString()}`)
      .then((res) => setReservations(res.data ?? []))
      .catch((err) => setError(err instanceof Error ? err.message : 'Error'));
  };

  useEffect(() => {
    loadReservations();
  }, [status, date]);

  const serviceMap = useMemo(() => new Map(services.map((service) => [service.id, service])), [services]);
  const staffMap = useMemo(() => new Map(staff.map((item) => [item.id, item])), [staff]);

  const filteredReservations = useMemo(() => {
    if (!query) return reservations;
    const term = query.toLowerCase();
    return reservations.filter((reservation) => {
      const clientMatch = reservation.client?.name?.toLowerCase().includes(term);
      const serviceMatch = reservation.details.some((detail) =>
        serviceMap.get(detail.serviceId)?.name?.toLowerCase().includes(term)
      );
      return clientMatch || serviceMatch;
    });
  }, [query, reservations, serviceMap]);

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

  const cancelReservation = async (id: number) => {
    try {
      await staffFetch(`/reservations/${id}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason: 'Cancelado desde panel' })
      });
      loadReservations();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cancelar');
    }
  };

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (!createForm.clientId || !createForm.serviceId || !createForm.staffId || !createForm.start) {
      setError('Completa cliente, servicio, especialista y fecha.');
      return;
    }
    try {
      await staffFetch('/reservations', {
        method: 'POST',
        body: JSON.stringify({
          clientId: Number(createForm.clientId),
          channel: 'PRESENCIAL',
          details: [
            {
              serviceId: Number(createForm.serviceId),
              staffId: Number(createForm.staffId),
              start: createForm.start
            }
          ]
        })
      });
      setCreateForm({ clientId: '', serviceId: '', staffId: '', start: '' });
      setShowCreate(false);
      loadReservations();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear');
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
          <button
            className="btn"
            onClick={() => {
              setShowCreate(true);
              setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
            }}
          >
            Nueva reserva
          </button>
        </div>
      </header>

      {showCreate && (
        <section className="card reveal" ref={formRef}>
          <div className="section-head">
            <div>
              <div className="eyebrow">Crear reserva</div>
              <h2>Agenda manual</h2>
            </div>
          </div>
          <form className="auth-form" onSubmit={handleCreate}>
            <label>
              Cliente
              <select
                value={createForm.clientId}
                onChange={(event) => setCreateForm({ ...createForm, clientId: event.target.value })}
              >
                <option value="">Selecciona</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>{client.name}</option>
                ))}
              </select>
            </label>
            <label>
              Servicio
              <select
                value={createForm.serviceId}
                onChange={(event) => setCreateForm({ ...createForm, serviceId: event.target.value })}
              >
                <option value="">Selecciona</option>
                {services.map((service) => (
                  <option key={service.id} value={service.id}>{service.name}</option>
                ))}
              </select>
            </label>
            <label>
              Especialista
              <select
                value={createForm.staffId}
                onChange={(event) => setCreateForm({ ...createForm, staffId: event.target.value })}
              >
                <option value="">Selecciona</option>
                {staff.map((member) => (
                  <option key={member.id} value={member.id}>{member.name}</option>
                ))}
              </select>
            </label>
            <label>
              Fecha y hora
              <input
                type="datetime-local"
                value={createForm.start}
                onChange={(event) => setCreateForm({ ...createForm, start: event.target.value })}
              />
            </label>
            {error && <div className="auth-error">{error}</div>}
            <button className="btn" type="submit">Crear reserva</button>
          </form>
        </section>
      )}

      <div className="toolbar">
        <div className="search wide">
          <span className="search-dot" />
          <input
            placeholder="Buscar cliente o servicio"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
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
              <option key={option} value={option}>{statusLabels[option] ?? option}</option>
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
          {filteredReservations.length === 0 && <div className="table-row">Sin reservas para esta fecha.</div>}
          {filteredReservations.map((item) => {
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
                <div className="table-title">{statusLabels[item.status] ?? item.status}</div>
                <div>
                  <select
                    className="chip"
                    value={item.status}
                    onChange={(event) => updateStatus(item.id, event.target.value)}
                  >
                    {statusOptions.map((option) => (
                      <option key={option} value={option}>{statusLabels[option] ?? option}</option>
                    ))}
                  </select>
                </div>
                <div className="table-actions">
                  <button className="chip" onClick={() => updateStatus(item.id, 'CONFIRMADA')}>Aceptar</button>
                  <button className="chip" onClick={() => updateStatus(item.id, 'EN_PROCESO')}>En proceso</button>
                  <button className="chip danger" onClick={() => cancelReservation(item.id)}>Cancelar</button>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
