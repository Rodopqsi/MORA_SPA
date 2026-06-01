'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { clientFetch } from '../../lib/clientApi';
import { useAuth } from '../../context/AuthContext';

type ClientProfile = {
  name?: string;
  phone?: string;
  email?: string | null;
};

type Reservation = {
  id: number;
  start: string;
  status: string;
  details: { serviceId: number }[];
};

const formatReservationDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Fecha pendiente';
  }

  return new Intl.DateTimeFormat('es-PE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(date);
};

const formatShortDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '--';
  }

  return new Intl.DateTimeFormat('es-PE', {
    day: 'numeric',
    month: 'short'
  }).format(date);
};

const formatShortTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Hora pendiente';
  }

  return new Intl.DateTimeFormat('es-PE', {
    hour: 'numeric',
    minute: '2-digit'
  }).format(date);
};

const normalizeStatusLabel = (status: string) =>
  status.toLowerCase().replace(/_/g, ' ');

const reservationStatusClass = (status: string) => {
  const normalized = status.toUpperCase();

  if (normalized.includes('CONFIRM') || normalized.includes('COMPLET')) {
    return 'account-status-ok';
  }

  if (normalized.includes('PEND') || normalized.includes('PROCES')) {
    return 'account-status-pending';
  }

  if (normalized.includes('ANUL') || normalized.includes('CANCEL')) {
    return 'account-status-muted';
  }

  return 'account-status-neutral';
};

const buildInitials = (name?: string) => {
  const parts = name?.trim().split(/\s+/).filter(Boolean) ?? [];
  if (parts.length === 0) {
    return 'CU';
  }

  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
};

export default function MiCuentaPage() {
  const { clearClient } = useAuth();
  const [profile, setProfile] = useState<ClientProfile | null>(null);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);

    Promise.all([
      clientFetch<{ data?: ClientProfile }>(`/client-auth/me`),
      clientFetch<{ data: Reservation[] }>(`/client-reservations`)
    ])
      .then(([profileRes, reservationsRes]) => {
        const profilePayload = profileRes.data ?? (profileRes as unknown as ClientProfile);
        setProfile(profilePayload);
        setReservations(reservationsRes.data ?? []);
        setError('');
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'No se pudo cargar la informacion.'))
      .finally(() => setLoading(false));
  }, []);

  const handleLogout = () => {
    clearClient();
    window.location.href = '/login';
  };

  const sortedReservations = [...reservations].sort(
    (left, right) => new Date(right.start).getTime() - new Date(left.start).getTime()
  );

  const nextReservation = [...reservations]
    .filter((item) => new Date(item.start).getTime() >= Date.now() && !/ANUL|CANCEL/i.test(item.status))
    .sort((left, right) => new Date(left.start).getTime() - new Date(right.start).getTime())[0] ?? null;

  const contactChannels = [profile?.phone, profile?.email].filter(Boolean).length;
  const initials = buildInitials(profile?.name);

  return (
    <div className="account-page">
      <section className="card reveal account-hero">
        <div className="account-hero-main">
          <div className="account-avatar">{initials}</div>

          <div className="account-hero-copy">
            <div className="eyebrow">Mi cuenta</div>
            <h1>Hola, {profile?.name ?? 'clienta'}</h1>
            <p>
              {loading
                ? 'Sincronizando tu informacion y tus reservas.'
                : 'Consulta tus datos, revisa tu historial y vuelve a reservar sin friccion.'}
            </p>

            <div className="account-kpi-row">
              <div className="account-kpi">
                <span>Reservas</span>
                <strong>{loading ? '--' : sortedReservations.length}</strong>
                <small>
                  {sortedReservations.length > 0 ? 'Historial disponible' : 'Tu primera cita aparecera aqui'}
                </small>
              </div>

              <div className="account-kpi">
                <span>Proxima cita</span>
                <strong>{nextReservation ? formatShortDate(nextReservation.start) : 'Libre'}</strong>
                <small>{nextReservation ? formatShortTime(nextReservation.start) : 'Sin visita programada'}</small>
              </div>

              <div className="account-kpi">
                <span>Contacto</span>
                <strong>{loading ? '--' : `${contactChannels}/2`}</strong>
                <small>Canales listos para recordatorios</small>
              </div>
            </div>
          </div>
        </div>

        <div className="account-hero-actions">
          <Link className="btn" href="/reservar">
            Nueva reserva
          </Link>
          <Link className="btn btn-outline" href="/tienda">
            Ver productos
          </Link>
          <button className="account-logout" type="button" onClick={handleLogout}>
            Cerrar sesion
          </button>
        </div>
      </section>

      {error && <div className="card account-banner-error">{error}</div>}

      <section className="grid grid-2 account-overview">
        <article className="card reveal account-panel">
          <div className="account-panel-head">
            <div>
              <div className="eyebrow">Perfil</div>
              <h2>Datos de contacto</h2>
            </div>
            <span className="pill">Cuenta lista</span>
          </div>

          <div className="account-contact-grid">
            <div className="account-contact-item">
              <span className="account-contact-label">Nombre</span>
              <strong>{profile?.name ?? 'No disponible'}</strong>
              <span>Identidad con la que registras tus reservas.</span>
            </div>

            <div className="account-contact-item">
              <span className="account-contact-label">Telefono</span>
              <strong>{profile?.phone ?? 'No registrado'}</strong>
              <span>Canal principal para recordatorios y confirmaciones.</span>
            </div>

            <div className="account-contact-item">
              <span className="account-contact-label">Email</span>
              <strong>{profile?.email ?? 'No registrado'}</strong>
              <span>Recibe seguimiento y futuras novedades de tu cuenta.</span>
            </div>
          </div>
        </article>

        <article className="card reveal account-panel">
          <div className="account-panel-head">
            <div>
              <div className="eyebrow">Acceso rapido</div>
              <h2>Promociones y siguientes pasos</h2>
            </div>
          </div>

          <div className="account-highlight-card">
            <strong>{nextReservation ? 'Tu siguiente visita ya esta registrada' : 'Todavia no tienes una cita activa'}</strong>
            <p>
              {nextReservation
                ? `Te esperamos el ${formatReservationDate(nextReservation.start)}.`
                : 'Agenda cuando quieras y consulta las promos activas antes de confirmar tu siguiente visita.'}
            </p>
          </div>

          <div className="account-chip-row">
            <Link className="chip" href="/#promos">
              Ver promociones
            </Link>
            <Link className="chip" href="/servicios">
              Servicios
            </Link>
            <Link className="chip" href="/tienda">
              Productos
            </Link>
          </div>
        </article>
      </section>

      <section className="card reveal account-history">
        <div className="section-head">
          <div>
            <div className="eyebrow">Mis reservas</div>
            <h2>Historial reciente</h2>
            <p className="account-section-copy">
              {nextReservation
                ? `Proxima visita: ${formatReservationDate(nextReservation.start)}.`
                : 'Aun no tienes reservas registradas; cuando agendes una cita apareceran aqui con fecha y estado.'}
            </p>
          </div>
          <Link className="chip" href="/reservar">
            Nueva reserva
          </Link>
        </div>

        {loading ? (
          <div className="account-empty-state">
            <strong>Cargando tu historial...</strong>
            <p>Estamos trayendo tus reservas y tus datos de contacto.</p>
          </div>
        ) : sortedReservations.length === 0 ? (
          <div className="account-empty-state">
            <strong>Aun no tienes reservas.</strong>
            <p>Reserva tu primera cita y desde aqui podras seguir fecha, estado y proximos movimientos.</p>
            <Link className="btn" href="/reservar">
              Reservar ahora
            </Link>
          </div>
        ) : (
          <div className="account-reservation-list">
            {sortedReservations.map((item) => (
              <article key={item.id} className="account-reservation-item">
                <div className="account-reservation-main">
                  <div className="account-reservation-title-row">
                    <strong>Reserva #{item.id}</strong>
                    <span className={`account-status ${reservationStatusClass(item.status)}`}>
                      {normalizeStatusLabel(item.status)}
                    </span>
                  </div>
                  <p>{formatReservationDate(item.start)}</p>
                </div>

                <div className="account-reservation-meta">
                  <span className="pill">
                    {item.details.length} servicio{item.details.length === 1 ? '' : 's'}
                  </span>
                  <span className="account-reservation-time">{formatShortTime(item.start)}</span>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
