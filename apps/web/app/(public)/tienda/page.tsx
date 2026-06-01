"use client";

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../lib/api';
import { clientFetch } from '../../lib/clientApi';
import { useAuth } from '../../context/AuthContext';
import { normalizePersonName, normalizePhone } from '../../lib/validation';
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
      <div className="shop-page reveal">
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

          <div className="shop-product-grid">
            {loading &&
              Array.from({ length: 4 }, (_, index) => (
                <div key={index} className="shop-skeleton-card" aria-hidden="true">
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
                  <article key={product.id} className="shop-product-card">
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
                        <button className="btn" type="button" onClick={() => addToCart(product)} disabled={soldOut}>
                          {soldOut ? 'Agotado' : 'Agregar al carrito'}
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
          </div>
          </section>
        </div>
      </div>

      <button
        type="button"
        className="shop-floating-cart"
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
      </button>

      <aside
        id="shop-cart-panel"
        className={`shop-cart-drawer ${cartOpen ? 'open' : ''}`}
        aria-hidden={!cartOpen}
      >
        <div className="shop-drawer-head">
          <div>
            <div className="eyebrow">Carrito</div>
            <h2>{totalItems} items</h2>
          </div>
          <div className="shop-drawer-actions">
            {!isClientAuthed && <Link href="/login" className="chip">Ingresar</Link>}
            <button type="button" className="icon-btn" onClick={() => setCartOpen(false)} aria-label="Cerrar carrito">
              x
            </button>
          </div>
        </div>

        <div className="shop-drawer-body">
          {success && (
            <div className="shop-drawer-status">
              <div className="eyebrow">Pedido registrado</div>
              <strong>Orden #{success.data.id}</strong>
              <p>
                Total S/ {Number(success.data.total).toFixed(2)}. {success.meta?.requiresGateway
                  ? 'La pasarela sigue como placeholder y puede conectarse despues.'
                  : 'El pedido ya puede confirmarse desde el panel.'}
              </p>
            </div>
          )}

          {checkoutError && <div className="auth-error">{checkoutError}</div>}

          {cart.length === 0 ? (
            <div className="empty-state shop-cart-empty">
              <strong>Tu carrito aun esta vacio.</strong>
              <span>Agrega productos del catalogo para habilitar el checkout.</span>
            </div>
          ) : (
            <>
              <div className="shop-cart-list">
                {cart.map((item) => (
                  <div key={item.productId} className="shop-cart-item">
                    <div className="shop-cart-item-main">
                      {item.imageUrl ? <img src={item.imageUrl} alt={item.name} /> : <div className="avatar">PD</div>}
                      <div>
                        <div className="list-title">{item.name}</div>
                        <div className="list-sub">S/ {item.price.toFixed(2)} c/u</div>
                      </div>
                    </div>
                    <div className="shop-cart-controls">
                      <button type="button" className="icon-btn" onClick={() => setCart((current) => updateCartItemQuantity(current, item.productId, item.quantity - 1))}>-</button>
                      <span className="pill">{item.quantity}</span>
                      <button type="button" className="icon-btn" onClick={() => setCart((current) => updateCartItemQuantity(current, item.productId, item.quantity + 1))}>+</button>
                      <button type="button" className="chip" onClick={() => setCart((current) => removeCartItem(current, item.productId))}>Quitar</button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="shop-total-row">
                <span>Subtotal</span>
                <strong>S/ {subtotal.toFixed(2)}</strong>
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
                <label>
                  Metodo de pago
                  <select value={checkout.method} onChange={(event) => setCheckout({ ...checkout, method: event.target.value as CheckoutForm['method'] })}>
                    <option value="PASARELA">Tarjeta / Pasarela</option>
                    <option value="YAPE">Yape</option>
                    <option value="EFECTIVO">Pago al recoger</option>
                  </select>
                </label>
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
