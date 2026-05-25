"use client";

import { useEffect, useRef, useState } from 'react';
import { staffFetch } from '../../lib/staffApi';
import { normalizePersonName, normalizePhone } from '../../lib/validation';

type Client = {
  id: number;
  name: string;
  phone: string;
  email?: string | null;
  active: boolean;
};

export default function ClientesPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [form, setForm] = useState({ name: '', phone: '', email: '' });
  const [editing, setEditing] = useState<Client | null>(null);
  const [error, setError] = useState('');
  const formRef = useRef<HTMLDivElement>(null);

  const loadClients = () => {
    staffFetch<{ data: Client[] }>('/clients')
      .then((res) => setClients(res.data ?? []))
      .catch((err) => setError(err instanceof Error ? err.message : 'Error'));
  };

  useEffect(() => {
    loadClients();
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    const payload = {
      name: form.name.trim(),
      phone: form.phone.trim(),
      email: form.email.trim()
    };

    try {
      if (editing) {
        await staffFetch(`/clients/${editing.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload)
        });
      } else {
        await staffFetch('/clients', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
      }
      setForm({ name: '', phone: '', email: '' });
      setEditing(null);
      loadClients();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    }
  };

  const toggleActive = async (client: Client) => {
    try {
      await staffFetch(`/clients/${client.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ active: !client.active })
      });
      loadClients();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al actualizar');
    }
  };

  return (
    <div className="page-stack">
      <header className="page-head">
        <div>
          <div className="eyebrow">Gestion de clientes</div>
          <h1>Relaciones que brillan</h1>
          <p>Segmenta, fideliza y celebra con experiencias personalizadas.</p>
        </div>
        <div className="page-actions">
          <button
            className="btn"
            onClick={() => {
              setEditing(null);
              formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
          >
            Nuevo cliente
          </button>
        </div>
      </header>

      <section className="card reveal" ref={formRef}>
        <div className="section-head">
          <div>
            <div className="eyebrow">Nuevo cliente</div>
            <h2>{editing ? 'Editar cliente' : 'Registrar cliente'}</h2>
          </div>
        </div>
        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            Nombre
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: normalizePersonName(e.target.value) })}
              pattern="[A-Za-zÀ-ÿ\s]+"
              title="Solo se permiten letras y espacios"
            />
          </label>
          <label>
            Telefono
            <input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: normalizePhone(e.target.value) })}
              inputMode="numeric"
              pattern="[0-9]+"
              title="Solo se permiten numeros"
            />
          </label>
          <label>
            Email
            <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </label>
          {error && <div className="auth-error">{error}</div>}
          <button className="btn" type="submit">Guardar</button>
        </form>
      </section>

      <section className="card reveal">
        <div className="section-head">
          <div>
            <div className="eyebrow">Clientes destacados</div>
            <h2>Seguimiento rapido</h2>
          </div>
          <button className="chip" onClick={loadClients}>Actualizar</button>
        </div>
        <div className="list">
          {clients.length === 0 && <div className="list-item">Sin clientes registrados.</div>}
          {clients.map((client) => (
            <div key={client.id} className="list-item">
              <div className="avatar">{client.name.split(' ').map((w) => w[0]).join('')}</div>
              <div className="list-main">
                <div className="list-title">{client.name}</div>
                <div className="list-sub">{client.phone}</div>
              </div>
              <div className="pill">{client.active ? 'Activo' : 'Inactivo'}</div>
              <div className="list-meta">
                <button className="chip" onClick={() => {
                  setEditing(client);
                  setForm({ name: client.name, phone: client.phone, email: client.email ?? '' });
                }}>Editar</button>
                <button className="chip" onClick={() => toggleActive(client)}>
                  {client.active ? 'Desactivar' : 'Activar'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
