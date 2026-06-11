'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { clientFetch } from '../../lib/clientApi';
import { useAuth } from '../../context/AuthContext';
import MoraScrollReveal from '../../components/MoraScrollReveal';

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

const formatLongDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('es-PE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: 'numeric',
    minute: '2-digit'
  }).format(date);
};

const formatShortDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('es-PE', { day: '2-digit', month: 'short' }).format(date);
};

const formatTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('es-PE', { hour: 'numeric', minute: '2-digit' }).format(date);
};

const buildInitials = (name?: string) => {
  const parts = name?.trim().split(/\s+/).filter(Boolean) ?? [];
  if (parts.length === 0) return '·';
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('');
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
      clientFetch<{ data?: ClientProfile }>('/client-auth/me'),
      clientFetch<{ data: Reservation[] }>('/client-reservations')
    ])
      .then(([profileRes, reservationsRes]) => {
        setProfile(profileRes.data ?? (profileRes as unknown as ClientProfile));
        setReservations(reservationsRes.data ?? []);
        setError('');
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'No se pudo cargar la información.'))
      .finally(() => setLoading(false));
  }, []);

  const handleLogout = () => {
    clearClient();
    window.location.href = '/login';
  };

  const sorted = useMemo(
    () =>
      [...reservations].sort(
        (a, b) => new Date(b.start).getTime() - new Date(a.start).getTime()
      ),
    [reservations]
  );

  const next = useMemo(
    () =>
      [...reservations]
        .filter(
          (r) => new Date(r.start).getTime() >= Date.now() && !/ANUL|CANCEL/i.test(r.status)
        )
        .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())[0] ?? null,
    [reservations]
  );

  const initials = buildInitials(profile?.name);
  const firstName = profile?.name?.split(' ')[0] ?? '';

  return (
    <div className="account account-minimal page-enter">
      <header className="account-min-head">
        <div className="account-min-id">
          <span className="account-min-avatar scale-in" aria-hidden>{initials}</span>
          <div className="account-min-id-text">
            <span className="account-min-eyebrow">Mi cuenta</span>
            <h1>{firstName ? `Hola, ${firstName}` : 'Tu cuenta'}</h1>
          </div>
        </div>

        <div className="account-min-actions">
          <Link className="btn btn-sm shine-on-hover press-feedback" href="/reservar">Reservar</Link>
          <button type="button" className="account-min-logout press-feedback" onClick={handleLogout}>
            Salir
          </button>
        </div>
      </header>

      {error && <p className="account-min-error">{error}</p>}

      <section className="account-min-summary">
        <div className="account-min-summary-item">
          <span>Email</span>
          <strong>{profile?.email ?? '—'}</strong>
        </div>
        <span className="account-min-divider" aria-hidden />
        <div className="account-min-summary-item">
          <span>Teléfono</span>
          <strong>{profile?.phone ?? '—'}</strong>
        </div>
        <span className="account-min-divider" aria-hidden />
        <div className="account-min-summary-item">
          <span>Reservas</span>
          <strong>{loading ? '—' : sorted.length}</strong>
        </div>
      </section>

      <section className="account-min-next">
        <div className="account-min-next-label">Próxima cita</div>
        <div className="account-min-next-value">
          {loading ? (
            <span className="account-min-muted">Cargando…</span>
          ) : next ? (
            <>
              <span className="account-min-date">{formatShortDate(next.start)}</span>
              <span className="account-min-sep">·</span>
              <span>{formatTime(next.start)}</span>
            </>
          ) : (
            <span className="account-min-muted">Sin cita activa</span>
          )}
        </div>
        {next && (
          <div className="account-min-next-full">{formatLongDate(next.start)}</div>
        )}
      </section>

      <section className="account-min-history">
        <div className="account-min-history-head">
          <h2>Historial</h2>
          <span className="account-min-muted">{sorted.length} reservas</span>
        </div>

        {loading ? (
          <p className="account-min-muted">Cargando…</p>
        ) : sorted.length === 0 ? (
          <div className="account-min-empty">
            <p>Aún no tienes reservas.</p>
            <Link className="btn btn-sm" href="/reservar">Reservar ahora</Link>
          </div>
        ) : (
          <MoraScrollReveal as="ul" className="account-min-list" selector=".account-min-list-item" variant="fade-up" stagger={0.07} duration={0.6}>
            {sorted.slice(0, 5).map((r) => (
              <li key={r.id} className="account-min-list-item lift-on-hover">
                <span className="account-min-list-date">{formatShortDate(r.start)}</span>
                <span className="account-min-list-time">{formatTime(r.start)}</span>
                <span className="account-min-list-status">{r.status.replace(/_/g, ' ').toLowerCase()}</span>
              </li>
            ))}
          </MoraScrollReveal>
        )}

        {sorted.length > 5 && (
          <p className="account-min-muted account-min-more">+ {sorted.length - 5} más</p>
        )}
      </section>

      <nav className="account-min-links" aria-label="Enlaces rápidos">
        <Link className="link-underline" href="/#promos">Promociones</Link>
        <span aria-hidden>·</span>
        <Link className="link-underline" href="/servicios">Servicios</Link>
        <span aria-hidden>·</span>
        <Link className="link-underline" href="/tienda">Tienda</Link>
      </nav>
    </div>
  );
}
