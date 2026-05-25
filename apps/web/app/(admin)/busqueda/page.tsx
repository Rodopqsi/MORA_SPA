'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { staffFetch } from '../../lib/staffApi';

type Client = {
  id: number;
  name: string;
  phone: string;
  email?: string | null;
  active: boolean;
};

type Service = {
  id: number;
  name: string;
  durationMin: number;
  priceBase: string;
  active: boolean;
};

type Reservation = {
  id: number;
  code: string;
  start: string;
  status: string;
  client?: { name: string; phone: string } | null;
  details: { serviceId: number; staffId: number | null }[];
};

export default function BusquedaAdminPage() {
  const [rawQuery, setRawQuery] = useState('');
  const [clients, setClients] = useState<Client[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setRawQuery(new URLSearchParams(window.location.search).get('q') ?? '');
  }, []);

  const query = rawQuery.trim().toLowerCase();

  useEffect(() => {
    setLoading(true);
    setError('');

    Promise.all([
      staffFetch<{ data: Client[] }>('/clients'),
      staffFetch<{ data: Service[] }>('/services'),
      staffFetch<{ data: Reservation[] }>('/reservations')
    ])
      .then(([clientsRes, servicesRes, reservationsRes]) => {
        setClients(clientsRes.data ?? []);
        setServices(servicesRes.data ?? []);
        setReservations(reservationsRes.data ?? []);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'No se pudo cargar la busqueda.');
      })
      .finally(() => setLoading(false));
  }, []);

  const serviceMap = useMemo(() => new Map(services.map((service) => [service.id, service])), [services]);

  const filteredClients = useMemo(() => {
    if (!query) {
      return [];
    }

    return clients.filter((client) => {
      return [client.name, client.phone, client.email ?? ''].some((value) => value.toLowerCase().includes(query));
    });
  }, [clients, query]);

  const filteredServices = useMemo(() => {
    if (!query) {
      return [];
    }

    return services.filter((service) => {
      return [service.name, service.priceBase, `${service.durationMin}`].some((value) => value.toLowerCase().includes(query));
    });
  }, [services, query]);

  const filteredReservations = useMemo(() => {
    if (!query) {
      return [];
    }

    return reservations.filter((reservation) => {
      const serviceNames = reservation.details
        .map((detail) => serviceMap.get(detail.serviceId)?.name ?? '')
        .join(' ')
        .toLowerCase();

      return [
        reservation.code,
        reservation.status,
        reservation.client?.name ?? '',
        reservation.client?.phone ?? '',
        serviceNames
      ].some((value) => value.toLowerCase().includes(query));
    });
  }, [query, reservations, serviceMap]);

  const totalResults = filteredClients.length + filteredServices.length + filteredReservations.length;

  return (
    <div className="page-stack">
      <header className="page-head">
        <div>
          <div className="eyebrow">Busqueda global</div>
          <h1>Resultados del administrador</h1>
          <p>
            {query ? `Mostrando coincidencias para "${rawQuery}".` : 'Escribe en la barra superior para buscar.'}
          </p>
        </div>
        <div className="page-actions">
          <div className="pill">{totalResults} resultado(s)</div>
        </div>
      </header>

      {error && <div className="auth-error">{error}</div>}
      {loading && <div className="card">Buscando informacion...</div>}
      {!loading && !query && <div className="card">Ingresa un cliente, servicio o cita en el buscador superior.</div>}
      {!loading && query && totalResults === 0 && <div className="card">No se encontraron coincidencias.</div>}

      {!loading && filteredClients.length > 0 && (
        <section className="card reveal">
          <div className="section-head">
            <div>
              <div className="eyebrow">Clientes</div>
              <h2>Coincidencias en clientes</h2>
            </div>
            <Link className="chip" href="/clientes">Ver modulo</Link>
          </div>
          <div className="list">
            {filteredClients.map((client) => (
              <div key={client.id} className="list-item">
                <div className="avatar">{client.name.split(' ').map((word) => word[0]).join('')}</div>
                <div className="list-main">
                  <div className="list-title">{client.name}</div>
                  <div className="list-sub">{client.phone} {client.email ? `· ${client.email}` : ''}</div>
                </div>
                <div className="pill">{client.active ? 'Activo' : 'Inactivo'}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {!loading && filteredServices.length > 0 && (
        <section className="card reveal">
          <div className="section-head">
            <div>
              <div className="eyebrow">Servicios</div>
              <h2>Coincidencias en servicios</h2>
            </div>
            <Link className="chip" href="/servicios">Ver modulo</Link>
          </div>
          <div className="grid grid-2">
            {filteredServices.map((service) => (
              <div key={service.id} className="card service-card">
                <div className="service-title">{service.name}</div>
                <div className="service-meta">
                  <span className="pill">{service.durationMin} min</span>
                  <span className="pill">S/ {service.priceBase}</span>
                </div>
                <div className="service-sub">Estado: {service.active ? 'Activo' : 'Inactivo'}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {!loading && filteredReservations.length > 0 && (
        <section className="card table-card reveal">
          <div className="section-head">
            <div>
              <div className="eyebrow">Citas</div>
              <h2>Coincidencias en reservas</h2>
            </div>
            <Link className="chip" href="/reservas">Ver modulo</Link>
          </div>
          <div className="table-head">
            <div>Codigo</div>
            <div>Fecha</div>
            <div>Cliente</div>
            <div>Servicios</div>
            <div>Estado</div>
          </div>
          <div className="table-body">
            {filteredReservations.map((reservation) => (
              <div key={reservation.id} className="table-row">
                <div className="table-title">{reservation.code}</div>
                <div className="table-sub">{new Date(reservation.start).toLocaleString('es-PE')}</div>
                <div>
                  <div className="table-title">{reservation.client?.name ?? 'Cliente'}</div>
                  <div className="table-sub">{reservation.client?.phone ?? '-'}</div>
                </div>
                <div className="table-sub">
                  {reservation.details
                    .map((detail) => serviceMap.get(detail.serviceId)?.name ?? `Servicio #${detail.serviceId}`)
                    .join(', ')}
                </div>
                <div className="pill">{reservation.status}</div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}