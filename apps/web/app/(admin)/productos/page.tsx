"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import { staffFetch } from '../../lib/staffApi';
import { CatalogProduct, getProductCover, ProductImage, productPrice } from '../../lib/shopCart';

type PaymentStatus = 'PENDIENTE' | 'CONFIRMADO' | 'ANULADO';

type Sale = {
  id: number;
  method: 'EFECTIVO' | 'YAPE' | 'PASARELA';
  total: string;
  date: string;
  customerName?: string | null;
  customerPhone?: string | null;
  customerEmail?: string | null;
  paymentStatus: PaymentStatus;
  paymentReference?: string | null;
  details: {
    id: number;
    quantity: number;
    subtotal: string;
    product: CatalogProduct;
  }[];
};

type ProductFormImage = {
  url: string;
  fileName: string;
  source: 'URL' | 'LOCAL';
  isCover: boolean;
};

type ProductForm = {
  id: number | null;
  name: string;
  description: string;
  category: string;
  price: string;
  stock: string;
  active: boolean;
  featured: boolean;
  images: ProductFormImage[];
};

const createEmptyImage = (): ProductFormImage => ({
  url: '',
  fileName: '',
  source: 'URL',
  isCover: true
});

const createEmptyForm = (): ProductForm => ({
  id: null,
  name: '',
  description: '',
  category: '',
  price: '',
  stock: '0',
  active: true,
  featured: false,
  images: [createEmptyImage()]
});

const ensureCover = (images: ProductFormImage[]) => {
  if (images.length === 0) return [createEmptyImage()];
  const coverIndex = images.findIndex((image) => image.isCover);
  return images.map((image, index) => ({
    ...image,
    isCover: coverIndex === -1 ? index === 0 : index === coverIndex
  }));
};

const mapProductToForm = (product: CatalogProduct): ProductForm => ({
  id: product.id,
  name: product.name,
  description: product.description ?? '',
  category: product.category ?? '',
  price: String(product.price),
  stock: String(product.stock),
  active: product.active,
  featured: product.featured,
  images: ensureCover(
    product.images.length
      ? product.images.map((image) => ({
          url: image.url,
          fileName: image.fileName ?? '',
          source: image.source,
          isCover: image.isCover
        }))
      : [createEmptyImage()]
  )
});

const readFileAsDataUrl = (file: File) =>
  new Promise<ProductFormImage>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve({
        url: typeof reader.result === 'string' ? reader.result : '',
        fileName: file.name,
        source: 'LOCAL',
        isCover: false
      });
    };
    reader.onerror = () => reject(new Error('No se pudo leer la imagen seleccionada.'));
    reader.readAsDataURL(file);
  });

export default function ProductosPage() {
  const [inventory, setInventory] = useState<CatalogProduct[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [form, setForm] = useState<ProductForm>(createEmptyForm());
  const [error, setError] = useState('');
  const [loadingFiles, setLoadingFiles] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);

  const loadProducts = () => {
    Promise.all([
      staffFetch<{ data: CatalogProduct[] }>('/products'),
      staffFetch<{ data: Sale[] }>('/sales')
    ])
      .then(([productsRes, salesRes]) => {
        setInventory(productsRes.data ?? []);
        setSales(salesRes.data ?? []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Error'));
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const metrics = useMemo(() => {
    const pendingOrders = sales.filter((sale) => sale.paymentStatus === 'PENDIENTE').length;
    const featuredCount = inventory.filter((product) => product.featured).length;
    const catalogValue = inventory.reduce((sum, product) => sum + productPrice(product.price) * product.stock, 0);

    return { pendingOrders, featuredCount, catalogValue };
  }, [inventory, sales]);

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      category: form.category.trim(),
      price: Number(form.price),
      stock: Number(form.stock),
      active: form.active,
      featured: form.featured,
      images: ensureCover(form.images.filter((image) => image.url.trim().length > 0)).map((image) => ({
        url: image.url.trim(),
        fileName: image.fileName.trim(),
        source: image.source,
        isCover: image.isCover
      }))
    };

    try {
      await staffFetch(form.id ? `/products/${form.id}` : '/products', {
        method: form.id ? 'PATCH' : 'POST',
        body: JSON.stringify(payload)
      });
      setForm(createEmptyForm());
      loadProducts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    }
  };

  const updateStock = async (product: CatalogProduct, delta: number) => {
    const nextStock = Math.max(0, product.stock + delta);
    try {
      await staffFetch(`/products/${product.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ stock: nextStock })
      });
      loadProducts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al actualizar');
    }
  };

  const toggleActive = async (product: CatalogProduct) => {
    try {
      await staffFetch(`/products/${product.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ active: !product.active })
      });
      loadProducts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al actualizar');
    }
  };

  const updatePaymentStatus = async (saleId: number, paymentStatus: PaymentStatus) => {
    try {
      await staffFetch(`/sales/${saleId}/payment-status`, {
        method: 'PATCH',
        body: JSON.stringify({ paymentStatus })
      });
      loadProducts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al actualizar la venta');
    }
  };

  const updateImage = (index: number, patch: Partial<ProductFormImage>) => {
    setForm((current) => ({
      ...current,
      images: ensureCover(current.images.map((image, itemIndex) => (itemIndex === index ? { ...image, ...patch } : image)))
    }));
  };

  const addImageField = () => {
    setForm((current) => ({
      ...current,
      images: ensureCover([...current.images, { ...createEmptyImage(), isCover: false }])
    }));
  };

  const removeImage = (index: number) => {
    setForm((current) => ({
      ...current,
      images: ensureCover(current.images.filter((_, itemIndex) => itemIndex !== index))
    }));
  };

  const handleLocalImages = async (files: FileList | null) => {
    if (!files?.length) return;

    setLoadingFiles(true);
    try {
      const uploaded = await Promise.all(Array.from(files).map((file) => readFileAsDataUrl(file)));
      setForm((current) => ({
        ...current,
        images: ensureCover([...current.images, ...uploaded])
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar las imagenes.');
    } finally {
      setLoadingFiles(false);
    }
  };

  return (
    <div className="page-stack">
      <header className="page-head">
        <div>
          <div className="eyebrow">Inventario y ventas</div>
          <h1>Mini ecommerce y control comercial</h1>
          <p>Gestiona el catalogo, prepara las imagenes y confirma los pedidos que llegan desde la tienda web.</p>
        </div>
        <div className="page-actions">
          <button className="btn" type="button" onClick={() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
            Nuevo producto
          </button>
          <button className="btn btn-outline" type="button" onClick={() => setForm(createEmptyForm())}>
            Limpiar formulario
          </button>
        </div>
      </header>

      <section className="grid grid-3">
        <div className="card stat-card tone-rose">
          <div className="stat-label">Productos activos</div>
          <div className="stat-value">{inventory.filter((product) => product.active).length}</div>
          <div className="stat-meta">Catalogo visible en la tienda publica.</div>
        </div>
        <div className="card stat-card tone-sun">
          <div className="stat-label">Pedidos pendientes</div>
          <div className="stat-value">{metrics.pendingOrders}</div>
          <div className="stat-meta">Ventas esperando confirmacion o anulacion.</div>
        </div>
        <div className="card stat-card tone-mint">
          <div className="stat-label">Valor estimado del stock</div>
          <div className="stat-value">S/ {metrics.catalogValue.toFixed(2)}</div>
          <div className="stat-meta">{metrics.featuredCount} productos marcados como destacados.</div>
        </div>
      </section>

      <section className="card reveal" ref={formRef}>
        <div className="section-head">
          <div>
            <div className="eyebrow">Producto ecommerce</div>
            <h2>{form.id ? 'Editar producto' : 'Registrar producto'}</h2>
          </div>
          <button className="chip" type="button" onClick={() => setForm(createEmptyForm())}>Reset</button>
        </div>
        <form className="auth-form" onSubmit={handleCreate}>
          <div className="grid grid-2">
            <label>
              Nombre
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </label>
            <label>
              Categoria
              <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Cabello, nails, barber..." />
            </label>
            <label>
              Precio
              <input type="number" min="0" step="0.01" required value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
            </label>
            <label>
              Stock
              <input type="number" min="0" required value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} />
            </label>
          </div>
          <label>
            Descripcion
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={4} placeholder="Explica beneficios, rutina de uso o motivo de compra." />
          </label>

          <div className="toggle-row">
            <label className="checkbox-row">
              <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
              Publicar en tienda
            </label>
            <label className="checkbox-row">
              <input type="checkbox" checked={form.featured} onChange={(e) => setForm({ ...form, featured: e.target.checked })} />
              Destacar en inicio
            </label>
          </div>

          <div className="media-builder">
            <div className="section-head">
              <div>
                <div className="eyebrow">Imagenes</div>
                <h3>URL o carga local</h3>
              </div>
              <button className="chip" type="button" onClick={addImageField}>Agregar URL</button>
            </div>

            <div className="image-form-grid">
              {form.images.map((image, index) => (
                <div key={`${image.fileName}-${index}`} className="image-form-card">
                  <div className="image-preview">
                    {image.url ? <img src={image.url} alt={`Imagen ${index + 1}`} /> : <div className="empty-state">Vista previa</div>}
                  </div>
                  <label>
                    URL o data URL
                    <input value={image.url} onChange={(e) => updateImage(index, { url: e.target.value, source: 'URL' })} placeholder="https://... o /assets/..." />
                  </label>
                  <label>
                    Nombre visible
                    <input value={image.fileName} onChange={(e) => updateImage(index, { fileName: e.target.value })} placeholder="producto-hero.jpg" />
                  </label>
                  <div className="image-toolbar">
                    <button className="chip" type="button" onClick={() => updateImage(index, { isCover: true })}>Portada</button>
                    <span className="pill">{image.source === 'LOCAL' ? 'Local' : 'URL'}</span>
                    <button className="chip" type="button" onClick={() => removeImage(index)}>Quitar</button>
                  </div>
                </div>
              ))}
            </div>

            <label className="upload-drop">
              <input type="file" accept="image/*" multiple onChange={(e) => handleLocalImages(e.target.files)} />
              {loadingFiles ? 'Procesando imagenes locales...' : 'Cargar imagenes desde tu equipo'}
            </label>
          </div>

          {error && <div className="auth-error">{error}</div>}
          <button className="btn" type="submit">{form.id ? 'Actualizar producto' : 'Guardar producto'}</button>
        </form>
      </section>

      <section className="card reveal">
        <div className="section-head">
          <div>
            <div className="eyebrow">Catalogo actual</div>
            <h2>Inventario listo para la tienda</h2>
          </div>
          <button className="chip" type="button" onClick={loadProducts}>Actualizar</button>
        </div>
        <div className="product-admin-grid">
          {inventory.length === 0 && <div className="empty-state">Todavia no hay productos cargados.</div>}
          {inventory.map((item) => {
            const cover = getProductCover(item);
            return (
              <article key={item.id} className="product-admin-card">
                <div className="product-admin-media">
                  {cover ? <img src={cover.url} alt={item.name} /> : <div className="empty-state">Sin imagen</div>}
                </div>
                <div className="product-admin-body">
                  <div className="section-head">
                    <div>
                      <div className="list-title">{item.name}</div>
                      <div className="list-sub">{item.category ?? 'Sin categoria'}</div>
                    </div>
                    <span className="price-tag">S/ {productPrice(item.price).toFixed(2)}</span>
                  </div>
                  <p>{item.description ?? 'Sin descripcion comercial todavia.'}</p>
                  <div className="chip-row">
                    <span className="pill">{item.stock} unidades</span>
                    <span className={`status-badge ${item.active ? 'status-ok' : 'status-warn'}`}>{item.active ? 'Publicado' : 'Oculto'}</span>
                    {item.featured && <span className="pill">Destacado</span>}
                  </div>
                  <div className="table-actions">
                    <button className="chip" type="button" onClick={() => {
                      setForm(mapProductToForm(item));
                      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }}>Editar</button>
                    <button className="chip" type="button" onClick={() => toggleActive(item)}>{item.active ? 'Ocultar' : 'Publicar'}</button>
                    <button className="icon-btn" type="button" onClick={() => updateStock(item, -1)}>-</button>
                    <button className="icon-btn" type="button" onClick={() => updateStock(item, 1)}>+</button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="card reveal">
        <div className="section-head">
          <div>
            <div className="eyebrow">Pedidos web</div>
            <h2>Checkout y estado de pago</h2>
          </div>
        </div>
        <div className="sale-order-grid">
          {sales.length === 0 && <div className="empty-state">Aun no hay ventas registradas.</div>}
          {sales.map((sale) => (
            <article key={sale.id} className="sale-order-card">
              <div className="sale-order-head">
                <div>
                  <div className="list-title">Pedido #{sale.id}</div>
                  <div className="list-sub">{sale.customerName ?? 'Compra interna'} - {new Date(sale.date).toLocaleString('es-PE')}</div>
                </div>
                <span className={`status-badge ${sale.paymentStatus === 'CONFIRMADO' ? 'status-ok' : 'status-warn'}`}>
                  {sale.paymentStatus}
                </span>
              </div>
              <div className="chip-row">
                <span className="pill">{sale.method}</span>
                <span className="pill">S/ {Number(sale.total).toFixed(2)}</span>
                {sale.customerPhone && <span className="pill">{sale.customerPhone}</span>}
              </div>
              <div className="sale-order-products">
                {sale.details.map((detail) => (
                  <div key={detail.id} className="list-item">
                    <div className="list-main">
                      <div className="list-title">{detail.product.name}</div>
                      <div className="list-sub">{detail.quantity} x S/ {Number(detail.subtotal).toFixed(2)}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="sale-order-actions">
                <button className="chip" type="button" onClick={() => updatePaymentStatus(sale.id, 'CONFIRMADO')}>Confirmar</button>
                <button className="chip" type="button" onClick={() => updatePaymentStatus(sale.id, 'PENDIENTE')}>Pendiente</button>
                <button className="chip" type="button" onClick={() => updatePaymentStatus(sale.id, 'ANULADO')}>Anular</button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
