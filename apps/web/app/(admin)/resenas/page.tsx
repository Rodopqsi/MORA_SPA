"use client";

import { useEffect, useState } from 'react';
import { staffFetch } from '../../lib/staffApi';

type Review = { id: number; clientId: number; rating: number; comment?: string | null; status: string; visible: boolean };
type Client = { id: number; name: string };

const statusLabel: Record<string, string> = {
  PENDIENTE: 'Pendiente',
  APROBADA: 'Aprobada',
  OCULTA: 'Oculta'
};

export default function ResenasPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [error, setError] = useState('');

  const loadData = () => {
    Promise.all([
      staffFetch<{ data: Review[] }>('/reviews'),
      staffFetch<{ data: Client[] }>('/clients')
    ])
      .then(([reviewRes, clientRes]) => {
        setReviews(reviewRes.data ?? []);
        setClients(clientRes.data ?? []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Error'));
  };

  useEffect(() => {
    loadData();
  }, []);

  const clientName = (clientId: number) =>
    clients.find((client) => client.id === clientId)?.name ?? `Cliente #${clientId}`;

  const moderate = async (reviewId: number, status: 'APROBADA' | 'OCULTA') => {
    try {
      await staffFetch(`/reviews/${reviewId}/moderate`, {
        method: 'PATCH',
        body: JSON.stringify({ status, visible: status === 'APROBADA' })
      });
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al actualizar');
    }
  };

  return (
    <div className="page-stack">
      <header className="page-head">
        <div>
          <div className="eyebrow">Resenas y reputacion</div>
          <h1>Lo que dicen tus clientas</h1>
          <p>Modera, responde y usa el feedback para mejorar.</p>
        </div>
        <div className="page-actions">
          <button className="btn" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            Nueva resena
          </button>
        </div>
      </header>

      {error && <div className="auth-error">{error}</div>}

      <section className="grid grid-2">
        {reviews.map((review, index) => (
          <div
            key={review.id}
            className="card review-card reveal"
            style={{ animationDelay: `${index * 80}ms` }}
          >
            <div className="review-header">
              <div className="avatar">{clientName(review.clientId).split(' ').map((w) => w[0]).join('')}</div>
              <div>
                <div className="list-title">{clientName(review.clientId)}</div>
                <div className="rating">Rating {review.rating}/5</div>
              </div>
              <span className={`status-badge ${review.status === 'APROBADA' ? 'status-ok' : 'status-warn'}`}>
                {statusLabel[review.status] ?? review.status}
              </span>
            </div>
            <p className="review-text">{review.comment ?? 'Sin comentario'}</p>
            <div className="service-actions">
              <button className="chip" onClick={() => moderate(review.id, 'APROBADA')}>Aprobar</button>
              <button className="chip" onClick={() => moderate(review.id, 'OCULTA')}>Ocultar</button>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
