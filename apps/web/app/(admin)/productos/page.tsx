"use client";

import { useEffect, useState } from 'react';
import { staffFetch } from '../../lib/staffApi';

type Product = { id: number; name: string; price: string; stock: number; active: boolean };

export default function ProductosPage() {
  const [inventory, setInventory] = useState<Product[]>([]);
  const [form, setForm] = useState({ name: '', price: 0, stock: 0 });
  const [error, setError] = useState('');

  const loadProducts = () => {
    staffFetch<{ data: Product[] }>('/products')
      .then((res) => setInventory(res.data ?? []))
      .catch((err) => setError(err instanceof Error ? err.message : 'Error'));
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await staffFetch('/products', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name,
          price: Number(form.price),
          stock: Number(form.stock)
        })
      });
      setForm({ name: '', price: 0, stock: 0 });
      loadProducts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    }
  };

  const updateStock = async (product: Product, delta: number) => {
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

  return (
    <div className="page-stack">
      <header className="page-head">
        <div>
          <div className="eyebrow">Inventario y ventas</div>
          <h1>Productos que acompanian la experiencia</h1>
          <p>Control de stock, precios y ventas al instante.</p>
        </div>
        <div className="page-actions">
          <button className="btn">Nuevo producto</button>
        </div>
      </header>

      <section className="card reveal">
        <div className="section-head">
          <div>
            <div className="eyebrow">Nuevo producto</div>
            <h2>Registrar producto</h2>
          </div>
        </div>
        <form className="auth-form" onSubmit={handleCreate}>
          <label>
            Nombre
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </label>
          <label>
            Precio
            <input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} />
          </label>
          <label>
            Stock
            <input type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: Number(e.target.value) })} />
          </label>
          {error && <div className="auth-error">{error}</div>}
          <button className="btn" type="submit">Guardar</button>
        </form>
      </section>

      <section className="card reveal">
        <div className="table-head">
          <div>Producto</div>
          <div>Stock</div>
          <div>Precio</div>
          <div>Estado</div>
          <div>Acciones</div>
        </div>
        <div className="table-body">
          {inventory.map((item) => (
            <div key={item.id} className="table-row">
              <div className="table-title">{item.name}</div>
              <div className="pill">{item.stock} unidades</div>
              <div className="table-title">S/ {item.price}</div>
              <div className={`status-badge ${item.stock > 5 ? 'status-ok' : 'status-warn'}`}>
                {item.stock > 5 ? 'Disponible' : 'Bajo stock'}
              </div>
              <div className="table-actions">
                <button className="icon-btn" onClick={() => updateStock(item, -1)}>-</button>
                <button className="icon-btn" onClick={() => updateStock(item, 1)}>+</button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
