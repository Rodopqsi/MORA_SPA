"use client";

import { useEffect, useState } from 'react';
import { staffFetch } from '../../lib/staffApi';
import { normalizePersonName, normalizePhone } from '../../lib/validation';
import MoraScrollReveal from '../../components/MoraScrollReveal';
import AvatarUploader from '../../components/AvatarUploader';
import ConfirmDialog from '../../components/ConfirmDialog';
import AdminModalForm from '../../components/AdminModalForm';

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
  avatarUrl?: string | null;
};

type ClientForm = {
  id: number | null;
  docType: string;
  docNumber: string;
  name: string;
  phone: string;
  whatsapp: string;
  email: string;
  birthDate: string;
  password: string;
  avatarUrl: string;
};

const createEmptyForm = (): ClientForm => ({
  id: null,
  docType: 'DNI',
  docNumber: '',
  name: '',
  phone: '',
  whatsapp: '',
  email: '',
  birthDate: '',
  password: '',
  avatarUrl: ''
});

const initialsOf = (name: string): string => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'CL';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

export default function ClientesPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [form, setForm] = useState<ClientForm>(createEmptyForm());
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Client | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [openForm, setOpenForm] = useState(false);

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

  const openCreate = () => {
    resetForm();
    setOpenForm(true);
  };

  const closeForm = () => setOpenForm(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setSaving(true);

    const payload = {
      docType: form.docType.trim() || undefined,
      docNumber: form.docNumber.trim() || undefined,
      whatsapp: form.whatsapp.trim() || undefined,
      birthDate: form.birthDate || undefined,
      name: form.name.trim(),
      phone: form.phone.trim(),
      email: form.email.trim() || undefined,
      avatarUrl: form.avatarUrl.trim() || null
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
      setOpenForm(false);
      loadClients();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
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
      password: '',
      avatarUrl: client.avatarUrl ?? ''
    });
    setOpenForm(true);
  };

  const handleDeleteConfirm = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    setError('');
    try {
      await staffFetch(`/clients/${confirmDelete.id}`, { method: 'DELETE' });
      if (form.id === confirmDelete.id) resetForm();
      loadClients();
      setConfirmDelete(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar');
    } finally {
      setDeleting(false);
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
    <div className="page-stack page-enter">
      <header className="page-head">
        <div>
          <div className="eyebrow">Gestión de clientes</div>
          <h1>Relaciones que brillan</h1>
          <p>Segmenta, fideliza y celebra con experiencias personalizadas.</p>
        </div>
        <div className="page-actions">
          <button
            className="btn btn-primary shine-on-hover press-feedback"
            onClick={openCreate}
          >
            + Añadir
          </button>
        </div>
      </header>

      <AdminModalForm
        open={openForm}
        onClose={closeForm}
        eyebrow={form.id ? 'Editar cliente' : 'Nuevo cliente'}
        title={form.id ? 'Actualizar cliente' : 'Registrar cliente'}
      >
        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="form-row-2">
            <label>
              Tipo de documento
              <input
                value={form.docType}
                onChange={(e) => setForm({ ...form, docType: e.target.value })}
                placeholder="DNI"
              />
            </label>
            <label>
              Nro. documento
              <input
                value={form.docNumber}
                onChange={(e) => setForm({ ...form, docNumber: e.target.value })}
                inputMode="numeric"
              />
            </label>
          </div>
          <div className="form-row-2">
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
              Fecha de nacimiento
              <input
                type="date"
                value={form.birthDate}
                onChange={(e) => setForm({ ...form, birthDate: e.target.value })}
              />
            </label>
          </div>
          <div className="form-row-2">
            <label>
              Teléfono
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
          </div>
          <div className="form-row-2">
            <label>
              Email
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </label>
            <label>
              Contraseña web
              <input
                type="password"
                minLength={6}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder={form.id ? 'Vacia para mantener la actual' : 'Opcional'}
              />
            </label>
          </div>

          <div className="form-section">
            <AvatarUploader
              bucket="clients"
              value={form.avatarUrl}
              fallbackInitials={initialsOf(form.name || 'Cliente')}
              onChange={(url) => setForm({ ...form, avatarUrl: url })}
              size={104}
              label="Avatar del cliente"
            />
            <p className="form-hint">Imagen cuadrada recomendada (PNG/JPG/WebP, max 5MB).</p>
          </div>

          {error && <div className="auth-error">{error}</div>}
          <div className="form-actions">
            <button className="btn btn-ghost" type="button" onClick={closeForm}>
              Cancelar
            </button>
            <button className="btn btn-primary" type="submit" disabled={saving}>
              {saving ? 'Guardando...' : form.id ? 'Actualizar cliente' : 'Guardar cliente'}
            </button>
          </div>
        </form>
      </AdminModalForm>

      <section className="card reveal">
        <div className="section-head">
          <div>
            <div className="eyebrow">Clientes registrados</div>
            <h2>Seguimiento rapido</h2>
          </div>
          <button className="chip press-feedback" onClick={loadClients}>
            Actualizar
          </button>
        </div>
        <MoraScrollReveal as="div" className="list" selector=".list-item" variant="fade-up" stagger={0.06} duration={0.5}>
          {clients.length === 0 && (
            <div className="empty-state">
              <div className="empty-state-icon">CL</div>
              <h3>Sin clientes registrados</h3>
              <p>Cuándo agregues el primero aparecera aqui.</p>
            </div>
          )}
          {clients.map((client, index) => {
            const initials = initialsOf(client.name);
            return (
              <div
                key={client.id}
                className="list-item reveal"
                style={{ animationDelay: `${index * 60}ms` }}
              >
                <div className="avatar avatar-md">
                  {client.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={client.avatarUrl} alt={client.name} />
                  ) : (
                    <span>{initials}</span>
                  )}
                </div>
                <div className="list-main">
                  <div className="list-title">{client.name}</div>
                  <div className="list-sub">
                    {client.phone}
                    {client.email ? ` · ${client.email}` : ''}
                  </div>
                </div>
                <div className="chip-row">
                  <span className="pill">
                    {client.docType ?? 'DOC'} {client.docNumber || 'Sin numero'}
                  </span>
                  {client.whatsapp && <span className="pill">Whatsapp {client.whatsapp}</span>}
                  <span className={`status-pill ${client.active ? 'status-on' : 'status-off'}`}>
                    {client.active ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
                <div className="list-meta">
                  <button className="chip press-feedback" onClick={() => handleEdit(client)}>
                    Editar
                  </button>
                  <button className="chip press-feedback" onClick={() => toggleActive(client)}>
                    {client.active ? 'Desactivar' : 'Activar'}
                  </button>
                  <button className="chip chip-danger press-feedback" onClick={() => setConfirmDelete(client)}>
                    Eliminar
                  </button>
                </div>
              </div>
            );
          })}
        </MoraScrollReveal>
      </section>

      <ConfirmDialog
        open={!!confirmDelete}
        title="Eliminar cliente"
        description={`Eliminar a "${confirmDelete?.name}"? Quedara archivado cómo inactivo y no podrá acceder a sus reservas.`}
        confirmLabel="Eliminar"
        variant="danger"
        loading={deleting}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
