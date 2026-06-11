"use client";

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../lib/api';
import { clientFetch } from '../../lib/clientApi';
import { useAuth } from '../../context/AuthContext';
import { normalizePersonName, normalizePhone } from '../../lib/validation';
import MoraScrollReveal from '../../components/MoraScrollReveal';
import {
  cartCount,
  cartSubtotal,
  CatalogProduct,
  CartItem,
  getProductCover,
  loadShopCart,
  productPrice,
  removeCartItem,
  saveShopCart,
  updateCartItemQuantity,
  upsertCartItem
} from '../../lib/shopCart';

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

const paymentDescriptions: Record<CheckoutForm['method'], string> = {
  EFECTIVO: 'Reserva tu pedido y paga al recogerlo en Mora Spa.',
  YAPE: 'Registra tu pedido y luego comparte el comprobante para confirmarlo.',
  PASARELA: 'Este es el ultimo paso del checkout. La integracion real de la pasarela queda lista para conectarse aqui.'
};

export default function TiendaPage() {
  const { isClientAuthed, refresh } = useAuth();
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [category, setCategory] = useState('Todas');
  const [cartOpen, setCartOpen] = useState(false);
  const [catalogError, setCatalogError] = useState('');
  const [checkoutError, setCheckoutError] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<OrderResponse | null>(null);
  const [checkout, setCheckout] = useState<CheckoutForm>(defaultCheckoutForm);
  const [cardNumber, setCardNumber] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [cardExpMonth, setCardExpMonth] = useState('');
  const [cardExpYear, setCardExpYear] = useState('');

  useEffect(() => {
    refresh();
    setCart(loadShopCart());
  }, [refresh]);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setCatalogError('');

    try {
      const res = await apiFetch<{ data: CatalogProduct[] }>('/public/products');
      setProducts(res.data ?? []);
    } catch (err) {
      setProducts([]);
      setCatalogError(err instanceof Error ? err.message : 'No se pudo cargar la tienda.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    saveShopCart(cart);
  }, [cart]);

  useEffect(() => {
    if (!products.length) return;

    setCart((current) => {
      const next: CartItem[] = [];

      for (const item of current) {
        const product = products.find((entry) => entry.id === item.productId);
        if (!product || !product.active || product.stock <= 0) {
          continue;
        }

        next.push({
          ...item,
          name: product.name,
          price: productPrice(product.price),
          stock: product.stock,
          imageUrl: getProductCover(product)?.url ?? item.imageUrl ?? null,
          quantity: Math.min(item.quantity, product.stock)
        });
      }

      return JSON.stringify(next) === JSON.stringify(current) ? current : next;
    });
  }, [products]);

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

  useEffect(() => {
    if (!cartOpen || typeof window === 'undefined') {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setCartOpen(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [cartOpen]);

  const categories = useMemo(
    () => ['Todas', ...new Set(products.map((product) => product.category).filter(Boolean) as string[])],
    [products]
  );

  const visibleProducts = useMemo(() => {
    if (category === 'Todas') return products;
    return products.filter((product) => product.category === category);
  }, [category, products]);

  const availableProducts = useMemo(
    () => products.filter((product) => product.stock > 0).length,
    [products]
  );

  const totalItems = cartCount(cart);
  const subtotal = cartSubtotal(cart);

  const addToCart = (product: CatalogProduct) => {
    if (product.stock <= 0) return;

    setCheckoutError('');
    setSuccess(null);
    setCart((current) =>
      upsertCartItem(current, {
        productId: product.id,
        name: product.name,
        price: productPrice(product.price),
        quantity: 1,
        stock: product.stock,
        imageUrl: getProductCover(product)?.url ?? null
      })
    );
  };

  const handleCheckout = async (event: React.FormEvent) => {
    event.preventDefault();

    if (cart.length === 0) {
      setCheckoutError('Agrega al menos un producto al carrito para continuar.');
      return;
    }

    setSubmitting(true);
    setCheckoutError('');

    try {
      // If using PASARELA, create token first
      if (checkout.method === 'PASARELA') {
        if (!cardNumber || !cardCvv || !cardExpMonth || !cardExpYear) {
          setCheckoutError('Ingresa los datos de tarjeta para procesar el pago.');
          setSubmitting(false);
          return;
        }

        try {
          const publicKey = process.env.NEXT_PUBLIC_CULQI_PUBLIC_KEY;
          if (!publicKey) throw new Error('Pasarela no configurada');

          const tokenResp = await fetch('https://secure.culqi.com/v2/tokens', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${publicKey}`
            },
            body: JSON.stringify({
              card_number: cardNumber.replace(/\s+/g, ''),
              cvv: cardCvv,
              expiration_month: cardExpMonth,
              expiration_year: cardExpYear,
              email: checkout.customerEmail || undefined
            })
          });

          const tokenJson = await tokenResp.json();
          if (!tokenResp.ok || !tokenJson.id) {
            throw new Error(tokenJson?.user_message || 'No se pudo generar token');
          }

          // Attach token id as paymentReference
          setCheckout((c) => ({ ...c, paymentReference: tokenJson.id }));
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
          paymentReference: checkout.paymentReference.trim(),
          notes: checkout.notes.trim(),
          items: cart.map((item) => ({
            productId: item.productId,
            quantity: item.quantity
          }))
        })
      });

      setSuccess(response);
      setCart([]);
      setCartOpen(true);
      setCheckout((current) => ({
        ...current,
        method: 'PASARELA',
        paymentReference: '',
        notes: ''
      }));
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : 'No se pudo registrar el pedido.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="shop-page page-enter">
        {catalogError && (
          <section className="card shop-message-card">
            <div>
              <div className="eyebrow">Catalogo no disponible</div>
              <h2>No se pudo cargar la tienda en este momento</h2>
              <p>{catalogError}</p>
            </div>
            <button className="btn btn-outline" type="button" onClick={() => void loadProducts()}>
              Reintentar carga
            </button>
          </section>
        )}

        <div className="shop-stage">
          <section id="catalogo" className="shop-catalog card">
          <div className="section-head">
            <div>
              <div className="eyebrow">Catalogo</div>
              <h2>Selecciona tus productos</h2>
              <div className="list-sub">Filtra por linea y arma el carrito con inventario real.</div>
            </div>
            <div className="shop-filter-row">
              {categories.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={`chip ${category === item ? 'chip-active' : ''}`}
                  onClick={() => setCategory(item)}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div className="shop-catalog-meta">
            <span className="pill">{visibleProducts.length} visibles</span>
            <span className="pill">{availableProducts} con stock disponible</span>
          </div>

          <MoraScrollReveal key={loading ? 'shop-loading' : 'shop-ready'} as="div" className="shop-product-grid" selector=".shop-product-card" variant="fade-up" stagger={0.08} duration={0.7}>
            {loading &&
              Array.from({ length: 4 }, (_, index) => (
                <div key={index} className="shop-skeleton-card shimmer" aria-hidden="true">
                  <div className="shop-skeleton-media" />
                  <div className="shop-skeleton-body">
                    <div className="shop-skeleton-line short" />
                    <div className="shop-skeleton-line" />
                    <div className="shop-skeleton-line" />
                  </div>
                </div>
              ))}

            {!loading && !catalogError && visibleProducts.length === 0 && (
              <div className="empty-state shop-empty-state">
                <strong>No hay productos en esta categoria.</strong>
                <span>Cambia el filtro o vuelve a la vista completa para seguir comprando.</span>
              </div>
            )}

            {!loading && !catalogError &&
              visibleProducts.map((product) => {
                const cover = getProductCover(product);
                const soldOut = product.stock <= 0;

                return (
                  <article key={product.id} className="shop-product-card lift-on-hover">
                    <div className="shop-product-media">
                      {cover ? <img src={cover.url} alt={product.name} /> : <div className="empty-state">Sin imagen</div>}
                      {product.featured && <span className="shop-ribbon">Destacado</span>}
                    </div>
                    <div className="shop-product-body">
                      <div className="shop-product-meta">
                        <div>
                          <h3>{product.name}</h3>
                          <div className="list-sub">{product.category ?? 'Linea Mora'}</div>
                        </div>
                        <div className="price-tag">S/ {Number(product.price).toFixed(2)}</div>
                      </div>
                      <p>{product.description ?? 'Producto profesional recomendado por el equipo Mora.'}</p>
                      <div className="shop-product-footer">
                        <span className={`status-badge ${soldOut ? 'status-warn' : 'status-ok'}`}>
                          {soldOut ? 'Sin stock' : `${product.stock} disponibles`}
                        </span>
                        <button className="btn shine-on-hover press-feedback" type="button" onClick={() => addToCart(product)} disabled={soldOut}>
                          {soldOut ? 'Agotado' : 'Agregar al carrito'}
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
          </MoraScrollReveal>
          </section>
        </div>
      </div>

      <button
        type="button"
        className={`shop-floating-cart ${totalItems > 0 ? 'has-items' : ''}`}
        onClick={() => setCartOpen((current) => !current)}
        aria-controls="shop-cart-panel"
        aria-expanded={cartOpen}
        aria-label={`Abrir carrito con ${totalItems} productos`}
      >
        <span className="shop-floating-cart-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="9" cy="19" r="1.6" />
            <circle cx="18" cy="19" r="1.6" />
            <path d="M3 4h2.2l2.3 9.4a1 1 0 0 0 1 .8h8.8a1 1 0 0 0 1-.8L20 8H7.1" />
          </svg>
          <span className="shop-floating-cart-badge">{totalItems}</span>
        </span>
        <span className="shop-floating-cart-copy">
          <span>Carrito</span>
          <strong>S/ {subtotal.toFixed(2)}</strong>
        </span>
        <span className="shop-floating-cart-chevron" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </span>
      </button>

      <aside
        id="shop-cart-panel"
        className={`shop-cart-drawer ${cartOpen ? 'open' : ''}`}
        aria-hidden={!cartOpen}
      >
        <div className="shop-drawer-head">
          <div className="shop-drawer-title">
            <div className="shop-drawer-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="9" cy="19" r="1.6" />
                <circle cx="18" cy="19" r="1.6" />
                <path d="M3 4h2.2l2.3 9.4a1 1 0 0 0 1 .8h8.8a1 1 0 0 0 1-.8L20 8H7.1" />
              </svg>
            </div>
            <div>
              <div className="eyebrow">Carrito</div>
              <h2>{totalItems} {totalItems === 1 ? 'producto' : 'productos'}</h2>
            </div>
          </div>
          <div className="shop-drawer-actions">
            {!isClientAuthed && <Link href="/login" className="chip">Ingresar</Link>}
            <button type="button" className="icon-btn shop-drawer-close" onClick={() => setCartOpen(false)} aria-label="Cerrar carrito">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        <div className="shop-drawer-body">
          {success && (
            <div className="shop-drawer-status">
              <div className="shop-status-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <div className="shop-status-content">
                <div className="eyebrow">Pedido registrado</div>
                <strong>Orden #{success.data.id}</strong>
                <p>
                  Total S/ {Number(success.data.total).toFixed(2)}. {success.meta?.requiresGateway
                    ? 'La pasarela sigue como placeholder y puede conectarse despues.'
                    : 'El pedido ya puede confirmarse desde el panel.'}
                </p>
              </div>
            </div>
          )}

          {checkoutError && <div className="auth-error">{checkoutError}</div>}

          {cart.length === 0 ? (
            <div className="empty-state shop-cart-empty">
              <div className="shop-cart-empty-art" aria-hidden="true">
                <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="24" cy="54" r="3" />
                  <circle cx="48" cy="54" r="3" />
                  <path d="M6 10h6l5 24a3 3 0 0 0 3 2.4h26a3 3 0 0 0 2.9-2.2L54 18H18" />
                  <path d="M30 6c0-1 1-2 2-2s2 1 2 2" stroke="currentColor" strokeOpacity="0.45" />
                  <path d="M40 8c0-1 1-2 2-2s2 1 2 2" stroke="currentColor" strokeOpacity="0.45" />
                </svg>
              </div>
              <strong>Tu carrito aun esta vacio</strong>
              <span>Explora el catalogo y suma tus productos favoritos para iniciar el checkout.</span>
            </div>
          ) : (
            <>
              <div className="shop-cart-list">
                {cart.map((item) => {
                  const lineTotal = item.price * item.quantity;
                  const atMax = item.quantity >= (item.stock ?? Infinity);
                  return (
                    <div key={item.productId} className="shop-cart-item">
                      <div className="shop-cart-item-media">
                        {item.imageUrl ? (
                          <img src={item.imageUrl} alt={item.name} />
                        ) : (
                          <div className="avatar" aria-hidden="true">PD</div>
                        )}
                      </div>
                      <div className="shop-cart-item-body">
                        <div className="shop-cart-item-head">
                          <div className="list-title">{item.name}</div>
                          <button
                            type="button"
                            className="shop-cart-remove"
                            onClick={() => setCart((current) => removeCartItem(current, item.productId))}
                            aria-label={`Quitar ${item.name}`}
                            title="Quitar"
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6l-1.4 14.1a2 2 0 0 1-2 1.9H8.4a2 2 0 0 1-2-1.9L5 6" />
                              <path d="M10 11v6" />
                              <path d="M14 11v6" />
                              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                            </svg>
                          </button>
                        </div>
                        <div className="shop-cart-item-sub">S/ {item.price.toFixed(2)} c/u</div>
                        <div className="shop-cart-item-foot">
                          <div className="shop-qty" role="group" aria-label={`Cantidad de ${item.name}`}>
                            <button
                              type="button"
                              className="shop-qty-btn"
                              onClick={() => setCart((current) => updateCartItemQuantity(current, item.productId, item.quantity - 1))}
                              aria-label="Disminuir cantidad"
                            >
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="5" y1="12" x2="19" y2="12" />
                              </svg>
                            </button>
                            <span className="shop-qty-value" aria-live="polite">{item.quantity}</span>
                            <button
                              type="button"
                              className="shop-qty-btn"
                              onClick={() => setCart((current) => updateCartItemQuantity(current, item.productId, item.quantity + 1))}
                              disabled={atMax}
                              aria-label="Aumentar cantidad"
                              title={atMax ? 'Stock maximo alcanzado' : 'Aumentar cantidad'}
                            >
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="12" y1="5" x2="12" y2="19" />
                                <line x1="5" y1="12" x2="19" y2="12" />
                              </svg>
                            </button>
                          </div>
                          <div className="shop-cart-line-total">S/ {lineTotal.toFixed(2)}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="shop-total-row">
                <span className="shop-total-label">Subtotal</span>
                <strong className="shop-total-amount">S/ {subtotal.toFixed(2)}</strong>
              </div>

              <form className="auth-form shop-checkout-form" onSubmit={handleCheckout}>
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
                  Telefono
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
                <div className="shop-payment-methods" role="radiogroup" aria-label="Metodo de pago">
                  {(['PASARELA', 'YAPE', 'EFECTIVO'] as const).map((method) => {
                    const labels: Record<CheckoutForm['method'], { title: string; sub: string; icon: string }> = {
                      PASARELA: { title: 'Tarjeta', sub: 'Pasarela online', icon: '\u{1F4B3}' },
                      YAPE: { title: 'Yape', sub: 'Comprobante digital', icon: '\u{1F4F1}' },
                      EFECTIVO: { title: 'Efectivo', sub: 'Pago al recoger', icon: '\u{1F4B5}' }
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
                        <span className="shop-payment-icon" aria-hidden="true">{labels[method].icon}</span>
                        <span className="shop-payment-text">
                          <strong>{labels[method].title}</strong>
                          <span>{labels[method].sub}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
                {checkout.method === 'PASARELA' && (
                  <div className="card-fields">
                    <label>
                      Numero de tarjeta
                      <input
                        required
                        value={cardNumber}
                        onChange={(e) => setCardNumber(e.target.value)}
                        inputMode="numeric"
                        placeholder="4111 1111 1111 1111"
                      />
                    </label>
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
                )}
                <label>
                  Referencia o comprobante
                  <input
                    value={checkout.paymentReference}
                    onChange={(event) => setCheckout({ ...checkout, paymentReference: event.target.value })}
                    placeholder={checkout.method === 'PASARELA' ? 'ID de pago futuro o checkout session' : 'Operacion, captura o nota interna'}
                  />
                </label>
                <label>
                  Notas del pedido
                  <textarea value={checkout.notes} onChange={(event) => setCheckout({ ...checkout, notes: event.target.value })} rows={4} />
                </label>

                <div className="shop-gateway-card">
                  <div className="eyebrow">Pasarela de pagos</div>
                  <strong>Ultimo paso del checkout</strong>
                  <p>{paymentDescriptions[checkout.method]}</p>
                </div>

                <button className="btn" type="submit" disabled={submitting || cart.length === 0}>
                  {submitting ? 'Procesando...' : 'Registrar pedido'}
                </button>
              </form>
            </>
          )}
        </div>
      </aside>
    </>
  );
}
