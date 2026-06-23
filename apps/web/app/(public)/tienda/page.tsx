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

const ITEMS_PER_PAGE = 8;

export default function TiendaPage() {
  const { isClientAuthed, refresh } = useAuth();
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
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

  /* Nuevo estado para filtros y paginación */
  const [searchQuery, setSearchQuery] = useState('');
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 300]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [minRating] = useState(0);
  const [page, setPage] = useState(1);
  const [cartOpen, setCartOpen] = useState(false);

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
    () => [...new Set(products.map((product) => product.category).filter(Boolean) as string[])],
    [products]
  );

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (product.description ?? '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchCategory = selectedCategories.length === 0 || selectedCategories.includes(product.category ?? '');
      const price = Number(product.price);
      const matchPrice = price >= priceRange[0] && price <= priceRange[1];
      return matchSearch && matchCategory && matchPrice;
    });
  }, [products, searchQuery, selectedCategories, priceRange]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(filteredProducts.length / ITEMS_PER_PAGE)), [filteredProducts]);

  const visibleProducts = useMemo(() => {
    const start = (page - 1) * ITEMS_PER_PAGE;
    return filteredProducts.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredProducts, page]);

  const availableProducts = useMemo(
    () => products.filter((product) => product.stock > 0).length,
    [products]
  );

  const toggleCategory = (cat: string) => {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
    setPage(1);
  };

  const totalItems = cartCount(cart);
  const subtotal = cartSubtotal(cart);

  const StarRating = ({ rating, size = 16 }: { rating: number; size?: number }) => {
    const stars = [];
    const full = Math.floor(rating);
    const hasHalf = rating - full >= 0.5;
    for (let i = 1; i <= 5; i++) {
      const filled = i <= full || (i === full + 1 && hasHalf);
      stars.push(
        <svg key={i} width={size} height={size} viewBox="0 0 24 24" fill={filled ? '#f59e0b' : 'none'} stroke="#f59e0b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      );
    }
    return <div className="shop-stars" aria-label={`${rating} estrellas`}>{stars}</div>;
  };

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
          // El navegador no puede llamar directo a Culqi (CORS bloqueado).
          // Pedimos al backend que tokenice la tarjeta y nos devuelva el id.
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

          // Attach token id as paymentReference
          setCheckout((c) => ({ ...c, paymentReference: tokenId }));
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

        <div className="shop-search-bar">
          <div className="shop-search-inner">
            <svg className="shop-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Busca tus productos aqui"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
              className="shop-search-input"
            />
            {searchQuery && (
              <button type="button" className="shop-search-clear" onClick={() => setSearchQuery('')} aria-label="Limpiar busqueda">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>
        </div>

        <div className="shop-layout">
          {/* Sidebar de filtros */}
          <aside className="shop-sidebar">
            <div className="shop-sidebar-block">
              <h4>Precio</h4>
              <div className="shop-range-values">
                <span>S/ {priceRange[0]}</span>
                <span>S/ {priceRange[1]}</span>
              </div>
              <input
                type="range"
                min={0}
                max={300}
                value={priceRange[1]}
                onChange={(e) => { setPriceRange([0, Number(e.target.value)]); setPage(1); }}
                className="shop-range-input"
              />
            </div>

            <div className="shop-sidebar-block">
              <h4>Categorías</h4>
              <div className="shop-sidebar-checks">
                {categories.map((cat) => (
                  <label key={cat} className="shop-sidebar-check">
                    <input
                      type="checkbox"
                      checked={selectedCategories.includes(cat)}
                      onChange={() => toggleCategory(cat)}
                    />
                    <span>{cat}</span>
                  </label>
                ))}
                {categories.length === 0 && (
                  <span className="shop-sidebar-empty">Sin categorías</span>
                )}
              </div>
            </div>

            <div className="shop-sidebar-block">
              <h4>Calificación</h4>
              <div className="shop-sidebar-rating">
                {[4, 3, 2, 1].map((r) => (
                  <button
                    key={r}
                    type="button"
                    className={`shop-rating-pill ${minRating === r ? 'active' : ''}`}
                    onClick={() => setPage(1)}
                  >
                    <StarRating rating={r} size={14} />
                    <span>{`${r}+ estrellas`}</span>
                  </button>
                ))}
              </div>
            </div>
          </aside>

          {/* Grid de productos */}
          <section className="shop-main">
            <div className="shop-main-head">
              <div>
                <div className="eyebrow">Catálogo</div>
                <h2>Selecciona tus productos</h2>
              </div>
              <div className="shop-results-count">
                {filteredProducts.length} {filteredProducts.length === 1 ? 'resultado' : 'resultados'}
              </div>
            </div>

            <MoraScrollReveal
              key={loading ? 'shop-loading' : `shop-ready-${page}`}
              as="div"
              className="shop-product-grid"
              selector=".shop-product-card"
              variant="fade-up"
              stagger={0.06}
              duration={0.6}
            >
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
                  <strong>No se encontraron productos.</strong>
                  <span>Prueba ajustando los filtros o busca con otras palabras.</span>
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
                        <div className="shop-product-tags">
                          <span className="shop-product-tag">{product.category ?? 'Linea Mora'}</span>
                        </div>
                        <h3 className="shop-product-title">{product.name}</h3>
                        <p className="shop-product-desc">{product.description ?? 'Producto profesional recomendado por el equipo Mora.'}</p>
                        <div className="shop-product-rating">
                          <StarRating rating={Math.min(5, Math.max(3.5, 4.2 + ((product.id * 37) % 10) / 10))} size={14} />
                          <span className="shop-rating-count">({Math.max(0, (product.id * 53) % 128)})</span>
                        </div>
                        <div className="shop-product-footer">
                          <div className="price-tag">S/ {Number(product.price).toFixed(2)}</div>
                          <button
                            className="shop-add-btn"
                            type="button"
                            onClick={() => addToCart(product)}
                            disabled={soldOut}
                            aria-label={soldOut ? 'Agotado' : `Agregar ${product.name} al carrito`}
                            title={soldOut ? 'Agotado' : 'Agregar al carrito'}
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <line x1="12" y1="5" x2="12" y2="19" />
                              <line x1="5" y1="12" x2="19" y2="12" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
            </MoraScrollReveal>

            {/* Paginación */}
            {!loading && !catalogError && totalPages > 1 && (
              <div className="shop-pagination">
                <button
                  type="button"
                  className="shop-page-btn"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  aria-label="Página anterior"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    type="button"
                    className={`shop-page-btn ${page === p ? 'active' : ''}`}
                    onClick={() => setPage(p)}
                    aria-label={`Página ${p}`}
                    aria-current={page === p ? 'page' : undefined}
                  >
                    {p}
                  </button>
                ))}
                <button
                  type="button"
                  className="shop-page-btn"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  aria-label="Página siguiente"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
              </div>
            )}
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
                    ? 'Pago pendiente de confirmacion por la pasarela.'
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
                              title={atMax ? 'Stock máximo alcanzado' : 'Aumentar cantidad'}
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
                <div className="shop-payment-methods" role="radiogroup" aria-label="Metodo de pago">
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
                {checkout.method === 'PASARELA' && (
                  <div className="card-fields">
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
                    placeholder={checkout.method === 'PASARELA' ? 'ID de pago futuro o checkout session' : 'Operación, captura o nota interna'}
                  />
                </label>
                <label>
                  Notas del pedido
                  <textarea value={checkout.notes} onChange={(event) => setCheckout({ ...checkout, notes: event.target.value })} rows={4} />
                </label>

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
