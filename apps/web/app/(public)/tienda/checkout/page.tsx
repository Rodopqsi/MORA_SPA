"use client";

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { apiFetch } from '../../../lib/api';
import { clientFetch } from '../../../lib/clientApi';
import { useAuth } from '../../../context/AuthContext';
import { normalizePersonName, normalizePhone } from '../../../lib/validation';
import {
  CartItem,
  cartCount,
  cartSubtotal,
  loadShopCart,
  saveShopCart,
} from '../../../lib/shopCart';

type ClientProfile = {
  name: string;
  phone: string;
  email?: string | null;
};

type OrderResponse = {
  data: {
    id: number;
    total: string | number;
    paymentStatus: 'PENDIENTE' | 'CONFIRMADO' | 'ANULADO';
    method: 'EFECTIVO' | 'YAPE' | 'PASARELA';
  };
  meta?: {
    requiresGateway?: boolean;
  };
};

type CheckoutForm = {
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  method: 'EFECTIVO' | 'YAPE' | 'PASARELA';
  paymentReference: string;
  notes: string;
};

const defaultCheckoutForm = (): CheckoutForm => ({
  customerName: '',
  customerPhone: '',
  customerEmail: '',
  method: 'PASARELA',
  paymentReference: '',
  notes: ''
});

export default function CheckoutPage() {
  const router = useRouter();
  const { isClientAuthed } = useAuth();

  const [cart, setCart] = useState<CartItem[]>([]);
  const [checkout, setCheckout] = useState<CheckoutForm>(defaultCheckoutForm);
  const [cardNumber, setCardNumber] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [cardExpMonth, setCardExpMonth] = useState('');
  const [cardExpYear, setCardExpYear] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');
  const [success, setSuccess] = useState<OrderResponse | null>(null);
  const [config, setConfig] = useState<any | null>(null);

  useEffect(() => {
    setCart(loadShopCart());
    apiFetch('/public/business-config')
      .then((res: any) => setConfig(res.data ?? null))
      .catch(() => setConfig(null));
  }, []);

  useEffect(() => {
    if (!isClientAuthed) return;

    clientFetch<{ data: ClientProfile }>('/client-auth/me')
      .then((res) => {
        const profile = res.data;
        setCheckout((current) => ({
          ...current,
          customerName: current.customerName || profile?.name || '',
          customerPhone: current.customerPhone || profile?.phone || '',
          customerEmail: current.customerEmail || profile?.email || ''
        }));
      })
      .catch(() => undefined);
  }, [isClientAuthed]);

  const totalItems = useMemo(() => cartCount(cart), [cart]);
  const subtotal = useMemo(() => cartSubtotal(cart), [cart]);

  const handleCheckout = async (event: React.FormEvent) => {
    event.preventDefault();

    if (cart.length === 0) {
      setCheckoutError('Agrega al menos un producto al carrito para continuar.');
      return;
    }

    setSubmitting(true);
    setCheckoutError('');

    try {
      let paymentRef = checkout.paymentReference;

      if (checkout.method === 'PASARELA') {
        if (!cardNumber || !cardCvv || !cardExpMonth || !cardExpYear) {
          setCheckoutError('Ingresa los datos de tarjeta para procesar el pago.');
          setSubmitting(false);
          return;
        }

        try {
          const tokenResp: any = await apiFetch('/public/culqi/token', {
            method: 'POST',
            body: JSON.stringify({
              card_number: cardNumber.replace(/\s+/g, ''),
              cvv: cardCvv,
              expiration_month: cardExpMonth,
              expiration_year: cardExpYear,
              email: checkout.customerEmail || undefined
            })
          });

          const tokenId = tokenResp?.data?.id;
          if (!tokenId) {
            throw new Error(tokenResp?.error?.message || 'No se pudo generar token');
          }

          paymentRef = tokenId;
        } catch (err) {
          setCheckoutError(err instanceof Error ? err.message : 'Error al tokenizar tarjeta');
          setSubmitting(false);
          return;
        }
      }

      const response = await apiFetch<OrderResponse>('/public/orders', {
        method: 'POST',
        body: JSON.stringify({
          customerName: checkout.customerName.trim(),
          customerPhone: checkout.customerPhone.trim(),
          customerEmail: checkout.customerEmail.trim(),
          method: checkout.method,
          paymentReference: paymentRef.trim(),
          notes: checkout.notes.trim(),
          items: cart.map((item) => ({
            productId: item.productId,
            quantity: item.quantity
          }))
        })
      });

      setSuccess(response);
      setCart([]);
      saveShopCart([]);
      setCheckout(defaultCheckoutForm());
      setCardNumber('');
      setCardCvv('');
      setCardExpMonth('');
      setCardExpYear('');
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : 'No se pudo registrar el pedido.');
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="page-enter public-content" style={{ maxWidth: 720, margin: '0 auto', padding: '40px 18px' }}>
        <div className="card" style={{ textAlign: 'center', padding: '40px 24px' }}>
          <div className="shop-status-icon" style={{ margin: '0 auto 16px', width: 64, height: 64 }} aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div className="eyebrow" style={{ color: 'var(--accent-dark)' }}>Pedido registrado</div>
          <h2 style={{ margin: '8px 0 6px' }}>Orden #{success.data.id}</h2>
          <p style={{ color: 'var(--muted)', marginBottom: 24 }}>
            Total <strong>S/ {Number(success.data.total).toFixed(2)}</strong>.{' '}
            {success.meta?.requiresGateway
              ? 'Pago pendiente de confirmación por la pasarela.'
              : 'El pedido ya puede confirmarse desde el panel.'}
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/tienda" className="btn btn-primary">
              Volver a la tienda
            </Link>
            <Link href="/" className="btn btn-ghost">
              Ir al inicio
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-enter public-content" style={{ maxWidth: 720, margin: '0 auto', padding: '32px 18px' }}>
      <div style={{ marginBottom: 24 }}>
        <div className="eyebrow">Tienda</div>
        <h1 style={{ margin: '4px 0 6px' }}>Finalizar compra</h1>
        <p style={{ color: 'var(--muted)' }}>Revisa tu pedido y completa los datos para registrarlo.</p>
      </div>

      {checkoutError && (
        <div className="auth-error" style={{ marginBottom: 18 }}>{checkoutError}</div>
      )}

      {cart.length === 0 ? (
        <div className="card empty-state" style={{ padding: '36px 24px', textAlign: 'center' }}>
          <strong>Tu carrito está vacío</strong>
          <span>Agrega productos desde la tienda para continuar.</span>
          <Link href="/tienda" className="btn btn-primary" style={{ marginTop: 18 }}>
            Ir a la tienda
          </Link>
        </div>
      ) : (
        <>
          <div className="card" style={{ marginBottom: 18, padding: '16px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <strong>Resumen del pedido</strong>
              <span style={{ color: 'var(--muted)', fontSize: 13 }}>{totalItems} {totalItems === 1 ? 'producto' : 'productos'}</span>
            </div>
            <div style={{ display: 'grid', gap: 10 }}>
              {cart.map((item) => (
                <div key={item.productId} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 48, height: 48, borderRadius: 10, overflow: 'hidden', flexShrink: 0, background: '#f3f0ec' }}>
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <div className="avatar" style={{ width: '100%', height: '100%', borderRadius: 0, fontSize: 12 }} aria-hidden="true">PD</div>
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="list-title" style={{ fontSize: 14 }}>{item.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>S/ {item.price.toFixed(2)} x {item.quantity}</div>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap' }}>
                    S/ {(item.price * item.quantity).toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
            <div className="shop-total-row" style={{ margin: '12px -2px 0' }}>
              <span className="shop-total-label">Subtotal</span>
              <strong className="shop-total-amount">S/ {subtotal.toFixed(2)}</strong>
            </div>
          </div>

          <form className="auth-form card" onSubmit={handleCheckout} style={{ padding: '22px 20px' }}>
            <label>
              Nombre completo
              <input
                required
                value={checkout.customerName}
                onChange={(event) => setCheckout({ ...checkout, customerName: normalizePersonName(event.target.value) })}
                pattern="[A-Za-zÀ-ÿ\s]+"
                title="Solo se permiten letras y espacios"
              />
            </label>
            <label>
              Teléfono
              <input
                required
                value={checkout.customerPhone}
                onChange={(event) => setCheckout({ ...checkout, customerPhone: normalizePhone(event.target.value) })}
                inputMode="numeric"
                pattern="[0-9]+"
                title="Solo se permiten numeros"
              />
            </label>
            <label>
              Email
              <input
                type="email"
                value={checkout.customerEmail}
                onChange={(event) => setCheckout({ ...checkout, customerEmail: event.target.value })}
              />
            </label>

            <div className="shop-payment-methods" role="radiogroup" aria-label="Metodo de pago" style={{ marginTop: 4 }}>
              {(['PASARELA', 'YAPE', 'EFECTIVO'] as const).map((method) => {
                const labels: Record<CheckoutForm['method'], { title: string; sub: string }> = {
                  PASARELA: { title: 'Tarjeta', sub: 'Pasarela online' },
                  YAPE: { title: 'Yape', sub: 'Comprobante digital' },
                  EFECTIVO: { title: 'Efectivo', sub: 'Pago al recoger' }
                };
                const active = checkout.method === method;
                return (
                  <button
                    key={method}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    className={`shop-payment-pill ${active ? 'active' : ''}`}
                    onClick={() => setCheckout({ ...checkout, method })}
                  >
                    <span className="shop-payment-text">
                      <strong>{labels[method].title}</strong>
                      <span>{labels[method].sub}</span>
                    </span>
                  </button>
                );
              })}
            </div>

            {checkout.method === 'YAPE' && (
              <div className="card" style={{ marginTop: 10, padding: '18px 16px', textAlign: 'center' }}>
                <div className="eyebrow" style={{ color: 'var(--accent-dark)', marginBottom: 8 }}>Pago con Yape</div>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
                  <div style={{ padding: 10, background: '#fff', borderRadius: 16, border: '1px solid rgba(198,90,125,0.12)' }}>
                    <QRCodeSVG
                      value={`yape://send?phone=${String(config?.yapePhone ?? '917364262').replace(/\s/g, '')}&amount=${subtotal.toFixed(2)}&message=Pedido Mora Spa`}
                      size={180}
                      level="M"
                      includeMargin={false}
                    />
                  </div>
                </div>
                <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 6 }}>
                  Escanea el QR con tu app Yape o envía el monto exacto al:
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#2d6a4f', letterSpacing: -0.5 }}>
                  S/ {subtotal.toFixed(2)}
                </div>
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--accent-dark)', marginTop: 4 }}>
                  {String(config?.yapePhone ?? '917364262').replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3')}
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>
                  Luego ingresa el número de operación como referencia abajo.
                </div>
              </div>
            )}

            {checkout.method === 'PASARELA' && (
              <div className="card-fields" style={{ marginTop: 8 }}>
                <label>
                  Número de tarjeta
                  <input
                    required
                    value={cardNumber}
                    onChange={(e) => setCardNumber(e.target.value)}
                    inputMode="numeric"
                    placeholder="4111 1111 1111 1111"
                  />
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                  <label>
                    CVV
                    <input required value={cardCvv} onChange={(e) => setCardCvv(e.target.value)} inputMode="numeric" placeholder="123" />
                  </label>
                  <label>
                    Mes
                    <input required value={cardExpMonth} onChange={(e) => setCardExpMonth(e.target.value)} inputMode="numeric" placeholder="MM" />
                  </label>
                  <label>
                    Año
                    <input required value={cardExpYear} onChange={(e) => setCardExpYear(e.target.value)} inputMode="numeric" placeholder="YYYY" />
                  </label>
                </div>
              </div>
            )}

            <label style={{ marginTop: 4 }}>
              Referencia o comprobante
              <input
                value={checkout.paymentReference}
                onChange={(event) => setCheckout({ ...checkout, paymentReference: event.target.value })}
                placeholder={checkout.method === 'PASARELA' ? 'ID de pago futuro o checkout session' : 'Operación, captura o nota interna'}
              />
            </label>
            <label>
              Notas del pedido
              <textarea value={checkout.notes} onChange={(event) => setCheckout({ ...checkout, notes: event.target.value })} rows={4} />
            </label>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 6 }}>
              <button className="btn btn-primary" type="submit" disabled={submitting || cart.length === 0}>
                {submitting ? 'Procesando...' : 'Registrar pedido'}
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => router.push('/tienda')}>
                Volver a la tienda
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  );
}
