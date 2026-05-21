'use client';

import { useEffect, useState } from 'react';
import { apiBaseUrl } from '../../lib/api';
import { clearToken, getToken } from '../../lib/auth';

type Reservation = {
  id: number;
  start: string;
  status: string;
  details: { serviceId: number }[];
};

export default function MiCuentaPage() {
  const [profile, setProfile] = useState<any>(null);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setError('Necesitas iniciar sesion.');
      return;
    }

    const headers = { Authorization: `Bearer ${token}` };

    Promise.all([
      fetch(`${apiBaseUrl}/client-auth/me`, { headers }).then((res) => res.json()),
      fetch(`${apiBaseUrl}/client-reservations`, { headers }).then((res) => res.json())
    ])
      .then(([profileRes, reservationsRes]) => {
        setProfile(profileRes.data ?? profileRes.client ?? profileRes.user ?? profileRes);
        setReservations(reservationsRes.data ?? []);
      })
      .catch(() => setError('No se pudo cargar la informacion.'));
  }, []);

  const handleLogout = () => {
    clearToken();
    window.location.href = '/login';
  };

  return (
    <div className="page-stack">
      <header className="page-head">
        <div>
          <div className="eyebrow">Mi cuenta</div>
          <h1>Hola, {profile?.name ?? 'Clienta'}</h1>
          <p>Administra tus reservas y promociones.</p>
        </div>
        <div className="page-actions">
          <button className="btn" onClick={handleLogout}>Cerrar sesion</button>
        </div>
      </header>

      {error && <div className="card">{error}</div>}

      <section className="grid grid-2">
        <div className="card reveal">
          <h3>Perfil</h3>
          <div className="list">
            <div className="list-item">
              <div className="list-main">
                <div className="list-title">Telefono</div>
                <div className="list-sub">{profile?.phone ?? '-'}</div>
              </div>
            </div>
            <div className="list-item">
              <div className="list-main">
                <div className="list-title">Email</div>
                <div className="list-sub">{profile?.email ?? '-'}</div>
              </div>
            </div>
          </div>
        </div>
        <div className="card reveal">
          <h3>Promociones disponibles</h3>
          <p>Consulta en recepcion las promos activas para tu proxima cita.</p>
        </div>
      </section>

      <section className="card reveal">
        <div className="section-head">
          <div>
            <div className="eyebrow">Mis reservas</div>
            <h2>Historial reciente</h2>
          </div>
          <a className="chip" href="/">Nueva reserva</a>
        </div>
        <div className="list">
          {reservations.length === 0 && <div className="list-item">Aun no tienes reservas.</div>}
          {reservations.map((item) => (
            <div key={item.id} className="list-item">
              <div className="list-main">
                <div className="list-title">Reserva #{item.id}</div>
                <div className="list-sub">{new Date(item.start).toLocaleString()}</div>
              </div>
              <div className={`status-badge status-${item.status.toLowerCase().replace('_', '-')}`}>
                {item.status}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
