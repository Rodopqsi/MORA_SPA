'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
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

type ProductSaleDetail = {
  productId: number;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  product?: { name?: string; images?: { url: string }[] };
};

type ProductSale = {
  id: number;
  date: string;
  total: number;
  method: 'EFECTIVO' | 'YAPE' | 'PASARELA';
  paymentStatus: 'CONFIRMADO' | 'ANULADO' | 'PENDIENTE';
  paymentProofUrl?: string | null;
  details: ProductSaleDetail[];
};

type ProductReview = {
  id: number;
  saleId: number;
  productId: number;
  rating: number;
  comment?: string | null;
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(value);

const formatOrderDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('es-PE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
};

const PAYMENT_LABEL: Record<ProductSale['method'], string> = {
  EFECTIVO: 'Efectivo',
  YAPE: 'Yape',
  PASARELA: 'Tarjeta'
};

const STATUS_LABEL: Record<ProductSale['paymentStatus'], string> = {
  PENDIENTE: 'Pendiente',
  CONFIRMADO: 'Pagado',
  ANULADO: 'Anulado'
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
  const [orders, setOrders] = useState<ProductSale[]>([]);
  const [productReviews, setProductReviews] = useState<ProductReview[]>([]);
  const [reviewing, setReviewing] = useState<{ saleId: number; productId: number } | null>(null);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      clientFetch<{ data?: ClientProfile }>('/client-auth/me'),
      clientFetch<{ data: Reservation[] }>('/client-reservations'),
      clientFetch<{ data: ProductSale[] }>('/client-orders'),
      clientFetch<{ data: ProductReview[] }>('/client/product-reviews')
    ])
      .then(([profileRes, reservationsRes, ordersRes, reviewsRes]) => {
        setProfile(profileRes.data ?? (profileRes as unknown as ClientProfile));
        setReservations(reservationsRes.data ?? []);
        setOrders(ordersRes.data ?? []);
        setProductReviews(reviewsRes.data ?? []);
        setError('');
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'No se pudo cargar la información.'))
      .finally(() => setLoading(false));
  }, []);

  const handleLogout = () => {
    clearClient();
    window.location.href = '/login';
  };

  const hasReview = (saleId: number, productId: number) =>
    productReviews.some((r) => r.saleId === saleId && r.productId === productId);

  const submitReview = useCallback(async () => {
    if (!reviewing || reviewRating === 0) return;
    setSubmittingReview(true);
    setReviewError('');
    try {
      await clientFetch('/client/product-reviews', {
        method: 'POST',
        body: JSON.stringify({
          saleId: reviewing.saleId,
          productId: reviewing.productId,
          rating: reviewRating,
          comment: reviewComment || undefined
        })
      });
      const res = await clientFetch<{ data: ProductReview[] }>('/client/product-reviews');
      setProductReviews(res.data ?? []);
      setReviewing(null);
      setReviewRating(0);
      setReviewComment('');
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : 'Error al enviar valoración');
    } finally {
      setSubmittingReview(false);
    }
  }, [reviewing, reviewRating, reviewComment]);

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
        <span className="account-min-divider" aria-hidden />
        <div className="account-min-summary-item">
          <span>Pedidos</span>
          <strong>{loading ? '—' : orders.length}</strong>
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

      <section className="account-min-orders">
        <div className="account-min-history-head">
          <h2>Mis pedidos</h2>
          <span className="account-min-muted">{orders.length} compras</span>
        </div>

        {loading ? (
          <p className="account-min-muted">Cargando…</p>
        ) : orders.length === 0 ? (
          <div className="account-min-empty">
            <p>Aún no has comprado productos.</p>
            <Link className="btn btn-sm" href="/tienda">Ir a la tienda</Link>
          </div>
        ) : (
          <ul className="account-min-orders-list">
            {orders.map((order) => (
              <li key={order.id} className="account-min-order-item lift-on-hover">
                <header className="account-min-order-head">
                  <div>
                    <span className="account-min-order-id">Pedido #{order.id}</span>
                    <span className="account-min-order-date">{formatOrderDate(order.date)}</span>
                  </div>
                  <span
                    className={`account-min-order-status status-${order.paymentStatus.toLowerCase()}`}
                  >
                    {STATUS_LABEL[order.paymentStatus] ?? order.paymentStatus}
                  </span>
                </header>
                <ul className="account-min-order-details">
                  {order.details.map((detail) => (
                    <li key={detail.productId} className="account-min-order-detail">
                      <span className="account-min-order-detail-name">
                        {detail.product?.name ?? `Producto #${detail.productId}`}
                      </span>
                      <span className="account-min-order-detail-qty">x{detail.quantity}</span>
                      <span className="account-min-order-detail-sub">
                        {formatCurrency(detail.subtotal)}
                      </span>
                      {order.paymentStatus === 'CONFIRMADO' && !hasReview(order.id, detail.productId) && (
                        <button
                          type="button"
                          className="btn btn-sm btn-ghost"
                          onClick={() => {
                            setReviewing({ saleId: order.id, productId: detail.productId });
                            setReviewRating(0);
                            setReviewComment('');
                            setReviewError('');
                          }}
                        >
                          Valorar
                        </button>
                      )}
                      {hasReview(order.id, detail.productId) && (
                        <span style={{ fontSize: 12, color: 'var(--accent-dark)' }}>Valorado</span>
                      )}
                      {reviewing?.saleId === order.id && reviewing?.productId === detail.productId && (
                        <div className="card" style={{ marginTop: 10, padding: 14, width: '100%' }}>
                          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                            {[1, 2, 3, 4, 5].map((star) => (
                              <button
                                key={star}
                                type="button"
                                onClick={() => setReviewRating(star)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}
                                aria-label={`${star} estrellas`}
                              >
                                <svg width={22} height={22} viewBox="0 0 24 24" fill={star <= reviewRating ? '#f59e0b' : 'none'} stroke="#f59e0b" strokeWidth="1.8">
                                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                                </svg>
                              </button>
                            ))}
                          </div>
                          <textarea
                            value={reviewComment}
                            onChange={(e) => setReviewComment(e.target.value)}
                            placeholder="Comentario opcional..."
                            rows={3}
                            style={{ width: '100%', marginBottom: 10 }}
                          />
                          {reviewError && <div className="auth-error" style={{ marginBottom: 8 }}>{reviewError}</div>}
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button className="btn btn-sm btn-primary" onClick={submitReview} disabled={submittingReview || reviewRating === 0}>
                              {submittingReview ? 'Enviando...' : 'Enviar'}
                            </button>
                            <button className="btn btn-sm btn-ghost" onClick={() => setReviewing(null)}>
                              Cancelar
                            </button>
                          </div>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
                <footer className="account-min-order-foot">
                  <span className="account-min-order-method">
                    Pago: {PAYMENT_LABEL[order.method] ?? order.method}
                  </span>
                  <span className="account-min-order-total">{formatCurrency(order.total)}</span>
                </footer>
                {order.paymentProofUrl && (
                  <a
                    className="account-min-order-proof"
                    href={order.paymentProofUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Ver comprobante
                  </a>
                )}
              </li>
            ))}
          </ul>
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
