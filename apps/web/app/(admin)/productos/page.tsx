"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import { staffFetch } from '../../lib/staffApi';
import { CatalogProduct, getProductCover, ProductImage, productPrice } from '../../lib/shopCart';
import MoraScrollReveal from '../../components/MoraScrollReveal';
import ConfirmDialog from '../../components/ConfirmDialog';
import { AdminForm } from '../../components/AdminForm';

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
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
    reader.readAsDataURL(file);
  });

export default function ProductosPage() {
  const [inventory, setInventory] = useState<CatalogProduct[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [form, setForm] = useState<ProductForm>(createEmptyForm());
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<CatalogProduct | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
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

  const totals = useMemo(() => {
    const stockValue = inventory.reduce((acc, item) => acc + item.stock, 0);
    const activeCount = inventory.filter((item) => item.active).length;
    const pending = sales.filter((sale) => sale.paymentStatus === 'PENDIENTE').length;
    return { stockValue, activeCount, pending };
  }, [inventory, sales]);

  const resetForm = () => {
    setForm(createEmptyForm());
    setError('');
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      category: form.category.trim() || undefined,
      price: Number(form.price) || 0,
      stock: Number(form.stock) || 0,
      active: form.active,
      featured: form.featured,
      images: form.images
        .filter((image) => image.url.trim().length > 0)
        .map((image, index) => ({
          url: image.url,
          fileName: image.fileName || undefined,
          source: image.source,
          isCover: image.isCover,
          order: index
        }))
    };

    try {
      if (form.id) {
        await staffFetch(`/products/${form.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload)
        });
      } else {
        await staffFetch('/products', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
      }
      resetForm();
      loadProducts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    }
  };

  const updateStock = async (product: CatalogProduct, delta: number) => {
    const newStock = Math.max(0, product.stock + delta);
    try {
      await staffFetch(`/products/${product.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ stock: newStock })
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

  const deleteProduct = (product: CatalogProduct) => {
    setConfirmDelete(product);
  };

  const handleDeleteConfirm = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    setError('');
    setSuccess('');
    try {
      await staffFetch(`/products/${confirmDelete.id}`, { method: 'DELETE' });
      if (form.id === confirmDelete.id) {
        setForm(createEmptyForm());
      }
      setSuccess(`"${confirmDelete.name}" archivado correctamente.`);
      loadProducts();
      setConfirmDelete(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar');
    } finally {
      setDeleting(false);
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
    <div className="page-stack page-enter">
      <header className="page-head">
        <div>
          <div className="eyebrow">Tienda y stock</div>
          <h1>Productos disponibles y pedidos</h1>
          <p>Administra catalogo, inventario y pagos del checkout web.</p>
        </div>
        <div className="page-actions">
          <button className="btn shine-on-hover press-feedback" onClick={() => {
            resetForm();
            formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }}>
            Nuevo producto
          </button>
        </div>
      </header>

      <MoraScrollReveal as="section" className="grid grid-3" selector=".card.lift-on-hover" variant="fade-up" stagger={0.08} duration={0.6}>
        <div className="card lift-on-hover">
          <div className="eyebrow">Productos</div>
          <h2>{inventory.length}</h2>
          <p>Cargados en el catalogo.</p>
        </div>
        <div className="card lift-on-hover">
          <div className="eyebrow">Stock total</div>
          <h2>{totals.stockValue}</h2>
          <p>{totals.activeCount} publicados.</p>
        </div>
        <div className="card lift-on-hover">
          <div className="eyebrow">Pagos pendientes</div>
          <h2>{totals.pending}</h2>
          <p>Pedidos por revisar.</p>
        </div>
      </MoraScrollReveal>

      <AdminForm
        eyebrow={form.id ? 'Editar producto' : 'Nuevo producto'}
        title={form.id ? 'Actualizar producto' : 'Registrar producto'}
        onReset={form.id ? resetForm : undefined}
        sectionRef={formRef}
      >
        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="form-row-2">
            <label>
              Nombre
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </label>
            <label>
              Categoría
              <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
            </label>
          </div>
          <label>
            Descripción
            <textarea
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </label>
          <div className="form-row-2">
            <label>
              Precio (S/)
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
              />
            </label>
            <label>
              Stock
              <input
                type="number"
                min="0"
                required
                value={form.stock}
                onChange={(e) => setForm({ ...form, stock: e.target.value })}
              />
            </label>
          </div>
          <div className="form-row-2">
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
              />
              <span>Publicado</span>
            </label>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={form.featured}
                onChange={(e) => setForm({ ...form, featured: e.target.checked })}
              />
              <span>Destacado</span>
            </label>
          </div>
          <div className="form-section">
            <div className="section-head" style={{ marginBottom: 12 }}>
              <div>
                <div className="eyebrow">Imágenes</div>
                <h2>Galería del producto</h2>
              </div>
              <div className="chip-row">
                <label className="chip">
                  Subir archivos
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    style={{ display: 'none' }}
                    onChange={(e) => handleLocalImages(e.target.files)}
                    disabled={loadingFiles}
                  />
                </label>
                <button className="chip" type="button" onClick={addImageField}>Agregar URL</button>
              </div>
            </div>
            <p className="form-hint">Marca una imagen cómo portada para que sea la principal en la tienda.</p>
            <div className="grid grid-2">
              {form.images.map((image, index) => (
                <div key={index} className="card" style={{ padding: 16 }}>
                  <div className="product-admin-media" style={{ marginBottom: 12, height: 160 }}>
                    {image.url ? <img src={image.url} alt={image.fileName || `Imagen ${index + 1}`} /> : <div className="empty-state">Sin imagen</div>}
                  </div>
                  <label>
                    URL o data URL
                    <input
                      value={image.url}
                      onChange={(e) => updateImage(index, { url: e.target.value })}
                      placeholder="https://..."
                    />
                  </label>
                  <label>
                    Nombre del archivo
                    <input
                      value={image.fileName}
                      onChange={(e) => updateImage(index, { fileName: e.target.value })}
                      placeholder="producto.jpg"
                    />
                  </label>
                  <label className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={image.isCover}
                      onChange={(e) => updateImage(index, { isCover: e.target.checked })}
                    />
                    <span>Portada</span>
                  </label>
                  <div className="service-actions">
                    <span className="pill">{image.source === 'LOCAL' ? 'Subida' : 'URL'}</span>
                    <button className="chip chip-danger" type="button" onClick={() => removeImage(index)}>Quitar</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          {error && <div className="auth-error">{error}</div>}
          <div className="form-actions">
            <button className="btn shine-on-hover press-feedback" type="submit">{form.id ? 'Actualizar producto' : 'Guardar producto'}</button>
            {form.id && (
              <button className="chip press-feedback" type="button" onClick={resetForm}>Cancelar</button>
            )}
          </div>
        </form>
      </AdminForm>

      {success && <div className="auth-success">{success}</div>}

      <section className="card reveal">
        <div className="section-head">
          <div>
            <div className="eyebrow">Catalogo</div>
            <h2>Inventario listo para la tienda</h2>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
              />
              Mostrar archivados
            </label>
            <button className="chip press-feedback" type="button" onClick={loadProducts}>Actualizar</button>
          </div>
        </div>
        <MoraScrollReveal as="div" className="product-admin-grid" selector=".product-admin-card" variant="fade-up" stagger={0.06} duration={0.5}>
          {inventory.filter((item) => showArchived || item.active).length === 0 && (
            <div className="empty-state">
              {showArchived ? 'No hay productos archivados.' : 'Todavia no hay productos cargados.'}
            </div>
          )}
          {inventory.filter((item) => showArchived || item.active).map((item) => {
            const cover = getProductCover(item);
            return (
              <article key={item.id} className="product-admin-card lift-on-hover">
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
                    <button className="chip press-feedback" type="button" onClick={() => {
                      setForm(mapProductToForm(item));
                      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }}>Editar</button>
                    <button className="chip press-feedback" type="button" onClick={() => toggleActive(item)}>{item.active ? 'Ocultar' : 'Publicar'}</button>
                    <button className="chip chip-danger press-feedback" type="button" onClick={() => setConfirmDelete(item)}>Eliminar</button>
                    <button className="icon-btn press-feedback" type="button" onClick={() => updateStock(item, -1)}>-</button>
                    <button className="icon-btn press-feedback" type="button" onClick={() => updateStock(item, 1)}>+</button>
                  </div>
                </div>
              </article>
            );
          })}
        </MoraScrollReveal>
      </section>

      <section className="card reveal">
        <div className="section-head">
          <div>
            <div className="eyebrow">Pedidos web</div>
            <h2>Checkout y estado de pago</h2>
          </div>
        </div>
        <div className="sale-order-grid">
          {sales.length === 0 && <div className="empty-state">Aún no hay ventas registradas.</div>}
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
                <button className="chip press-feedback" type="button" onClick={() => updatePaymentStatus(sale.id, 'CONFIRMADO')}>Confirmar</button>
                <button className="chip press-feedback" type="button" onClick={() => updatePaymentStatus(sale.id, 'PENDIENTE')}>Pendiente</button>
                <button className="chip press-feedback" type="button" onClick={() => updatePaymentStatus(sale.id, 'ANULADO')}>Anular</button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        title="Eliminar producto"
        description={
          confirmDelete
            ? `Archivar "${confirmDelete.name}"? Se ocultará de la tienda pero permanecerá en el sistema.`
            : ''
        }
        confirmLabel="Eliminar"
        variant="danger"
        loading={deleting}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
