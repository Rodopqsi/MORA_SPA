"use client";

import { useEffect, useRef, useState } from 'react';
import { staffFetch } from '../../lib/staffApi';
import { normalizePersonName, normalizePhone } from '../../lib/validation';

type Client = {
  id: number;
  docType?: string | null;
  docNumber?: string | null;
  name: string;
  phone: string;
  whatsapp?: string | null;
  email?: string | null;
  birthDate?: string | null;
  active: boolean;
};

const createEmptyForm = () => ({
  id: null as number | null,
  docType: 'DNI',
  docNumber: '',
  name: '',
  phone: '',
  whatsapp: '',
  email: '',
  birthDate: '',
  password: ''
});

export default function ClientesPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [form, setForm] = useState(createEmptyForm());
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

  const resetForm = () => {
    setForm(createEmptyForm());
    setError('');
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    const payload = {
      docType: form.docType.trim() || undefined,
      docNumber: form.docNumber.trim() || undefined,
      whatsapp: form.whatsapp.trim() || undefined,
      birthDate: form.birthDate || undefined,
      name: form.name.trim(),
      phone: form.phone.trim(),
      email: form.email.trim() || undefined
    };

    try {
      let clientId = form.id;

      if (form.id) {
        await staffFetch(`/clients/${form.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload)
        });
      } else {
        const response = await staffFetch<{ data: Client }>('/clients', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        clientId = response.data.id;
      }

      if (clientId && form.password.trim()) {
        await staffFetch(`/clients/${clientId}/credentials`, {
          method: 'PUT',
          body: JSON.stringify({
            password: form.password.trim(),
            email: form.email.trim() || undefined
          })
        });
      }

      resetForm();
      loadClients();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    }
  };

  const handleEdit = (client: Client) => {
    setForm({
      id: client.id,
      docType: client.docType ?? 'DNI',
      docNumber: client.docNumber ?? '',
      name: client.name,
      phone: client.phone,
      whatsapp: client.whatsapp ?? '',
      email: client.email ?? '',
      birthDate: client.birthDate?.slice(0, 10) ?? '',
      password: ''
    });
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleDelete = async (client: Client) => {
    const confirmed = window.confirm(`Eliminar a ${client.name}? Quedara archivado como inactivo.`);
    if (!confirmed) return;

    setError('');
    try {
      await staffFetch(`/clients/${client.id}`, { method: 'DELETE' });
      if (form.id === client.id) {
        resetForm();
      }
      loadClients();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar');
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
              resetForm();
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
            <div className="eyebrow">{form.id ? 'Editar cliente' : 'Nuevo cliente'}</div>
            <h2>{form.id ? 'Actualizar cliente' : 'Registrar cliente'}</h2>
          </div>
          <button className="chip" type="button" onClick={resetForm}>Limpiar</button>
        </div>
        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="grid grid-2">
            <label>
              Tipo de documento
              <input value={form.docType} onChange={(e) => setForm({ ...form, docType: e.target.value })} />
            </label>
            <label>
              Nro. documento
              <input value={form.docNumber} onChange={(e) => setForm({ ...form, docNumber: e.target.value })} />
            </label>
          </div>
          <label>
            Nombre
            <input
              required
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
            Whatsapp
            <input
              value={form.whatsapp}
              onChange={(e) => setForm({ ...form, whatsapp: normalizePhone(e.target.value) })}
              inputMode="numeric"
              pattern="[0-9]+"
              title="Solo se permiten numeros"
            />
          </label>
          <label>
            Email
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </label>
          <label>
            Fecha de nacimiento
            <input type="date" value={form.birthDate} onChange={(e) => setForm({ ...form, birthDate: e.target.value })} />
          </label>
          <label>
            Contrasena web
            <input
              type="password"
              minLength={6}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder={form.id ? 'Deja vacio para mantener la actual' : 'Opcional'}
            />
          </label>
          {error && <div className="auth-error">{error}</div>}
          <button className="btn" type="submit">{form.id ? 'Actualizar' : 'Guardar'}</button>
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
                <div className="list-sub">{client.phone}{client.email ? ` · ${client.email}` : ''}</div>
              </div>
              <div className="chip-row">
                <span className="pill">{client.docType ?? 'DOC'} {client.docNumber || 'Sin numero'}</span>
                {client.whatsapp && <span className="pill">Whatsapp {client.whatsapp}</span>}
                <span className="pill">{client.active ? 'Activo' : 'Inactivo'}</span>
              </div>
              <div className="list-meta">
                <button className="chip" onClick={() => handleEdit(client)}>Editar</button>
                <button className="chip" onClick={() => toggleActive(client)}>
                  {client.active ? 'Desactivar' : 'Activar'}
                </button>
                <button className="chip" onClick={() => handleDelete(client)}>Eliminar</button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
