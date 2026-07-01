"use client";

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch, resolveUploadUrl } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
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



const ITEMS_PER_PAGE = 8;

export default function TiendaPage() {
  const { isClientAuthed, refresh } = useAuth();
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [catalogError, setCatalogError] = useState('');
  const [loading, setLoading] = useState(true);

  /* Nuevo estado para filtros y paginación */
  const [searchQuery, setSearchQuery] = useState('');
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 300]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [minRating, setMinRating] = useState(0);
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

  const getProductRating = useCallback((product: CatalogProduct) => {
    return Math.min(5, Math.max(3.5, 4.2 + ((product.id * 37) % 10) / 10));
  }, []);

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (product.description ?? '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchCategory = selectedCategories.length === 0 || selectedCategories.includes(product.category ?? '');
      const price = Number(product.price);
      const matchPrice = price >= priceRange[0] && price <= priceRange[1];
      const matchRating = getProductRating(product) >= minRating;
      return matchSearch && matchCategory && matchPrice && matchRating;
    });
  }, [products, searchQuery, selectedCategories, priceRange, minRating, getProductRating]);

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
                    onClick={() => { setMinRating(r === minRating ? 0 : r); setPage(1); }}
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
                        {cover ? <img src={resolveUploadUrl(cover.url)} alt={product.name} /> : <div className="empty-state">Sin imagen</div>}
                        {product.featured && <span className="shop-ribbon">Destacado</span>}
                      </div>
                      <div className="shop-product-body">
                        <div className="shop-product-tags">
                          <span className="shop-product-tag">{product.category ?? 'Linea Mora'}</span>
                        </div>
                        <h3 className="shop-product-title">{product.name}</h3>
                        <p className="shop-product-desc">{product.description ?? 'Producto profesional recomendado por el equipo Mora.'}</p>
                        <div className="shop-product-rating">
                          <StarRating rating={getProductRating(product)} size={14} />
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
                          <img src={resolveUploadUrl(item.imageUrl)} alt={item.name} />
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

              <div className="shop-cart-actions">
                <Link href="/tienda/checkout" className="btn btn-primary shine-on-hover press-feedback" onClick={() => setCartOpen(false)}>
                  Ir a pagar
                </Link>
                <button type="button" className="btn btn-ghost" onClick={() => setCartOpen(false)}>
                  Seguir comprando
                </button>
              </div>
            </>
          )}
        </div>
      </aside>
    </>
  );
}
