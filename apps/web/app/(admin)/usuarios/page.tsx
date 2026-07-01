"use client";

import { useEffect, useState } from 'react';
import { staffFetch } from '../../lib/staffApi';
import { normalizePersonName } from '../../lib/validation';
import MoraScrollReveal from '../../components/MoraScrollReveal';
import ConfirmDialog from '../../components/ConfirmDialog';
import AdminModalForm from '../../components/AdminModalForm';

type User = { id: number; username: string; fullName: string; active: boolean; roles: string[] };

const createEmptyForm = () => ({
  id: null as number | null,
  username: '',
  fullName: '',
  password: '',
  role: 'RECEPCION'
});

export default function UsuariosPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<string[]>([]);
  const [form, setForm] = useState(createEmptyForm());
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<User | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [openForm, setOpenForm] = useState(false);

  const loadData = () => {
    Promise.all([
      staffFetch<{ data: User[] }>('/users'),
      staffFetch<{ data: { name: string }[] }>('/roles')
    ])
      .then(([usersRes, rolesRes]) => {
        setUsers(usersRes.data ?? []);
        setRoles(rolesRes.data?.map((role) => role.name) ?? []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Error'));
  };

  useEffect(() => {
    loadData();
  }, []);

  const resetForm = () => {
    setForm({ ...createEmptyForm(), role: roles[0] ?? 'RECEPCION' });
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
    const payload = {
      username: form.username.trim(),
      fullName: form.fullName.trim(),
      password: form.password.trim() || undefined,
      roles: [form.role]
    };

    try {
      if (form.id) {
        await staffFetch(`/users/${form.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            username: payload.username,
            fullName: payload.fullName,
            password: payload.password
          })
        });
        await staffFetch(`/users/${form.id}/roles`, {
          method: 'PUT',
          body: JSON.stringify({ roles: payload.roles })
        });
      } else {
        await staffFetch('/auth/register', {
          method: 'POST',
          body: JSON.stringify({
            username: payload.username,
            fullName: payload.fullName,
            password: form.password,
            roles: payload.roles
          })
        });
      }
      resetForm();
      setOpenForm(false);
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear');
    }
  };

  const handleEdit = (user: User) => {
    setForm({
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      password: '',
      role: user.roles[0] ?? roles[0] ?? 'RECEPCION'
    });
    setOpenForm(true);
  };

  const handleDeleteConfirm = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    setError('');
    try {
      await staffFetch(`/users/${confirmDelete.id}`, { method: 'DELETE' });
      if (form.id === confirmDelete.id) {
        resetForm();
      }
      loadData();
      setConfirmDelete(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar');
    } finally {
      setDeleting(false);
    }
  };

  const toggleActive = async (user: User) => {
    try {
      await staffFetch(`/users/${user.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ active: !user.active })
      });
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al actualizar');
    }
  };

  return (
    <div className="page-stack page-enter">
      <header className="page-head">
        <div>
          <div className="eyebrow">Control de usuarios</div>
          <h1>Usuarios y permisos</h1>
          <p>Gestiona roles y accesos del personal.</p>
        </div>
        <div className="page-actions">
          <button
            className="btn shine-on-hover press-feedback"
            onClick={openCreate}
          >
            + Añadir
          </button>
        </div>
      </header>

      <AdminModalForm
        open={openForm}
        onClose={closeForm}
        eyebrow={form.id ? 'Editar usuario' : 'Nuevo usuario'}
        title={form.id ? 'Actualizar acceso' : 'Crear acceso'}
      >
        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            Usuario
            <input
              required
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
            />
          </label>
          <label>
            Nombre completo
            <input
              required
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: normalizePersonName(e.target.value) })}
              pattern="[A-Za-zÀ-ÿ\s]+"
              title="Solo se permiten letras y espacios"
            />
          </label>
          <label>
            Contraseña
            <input
              type="password"
              required={!form.id}
              minLength={form.id ? 0 : 6}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder={form.id ? 'Deja vacio para mantener la actual' : ''}
            />
          </label>
          <label>
            Rol
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              {roles.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </label>
          {error && <div className="auth-error">{error}</div>}
          <div className="form-actions">
            <button className="btn btn-ghost" type="button" onClick={closeForm}>Cancelar</button>
            <button className="btn shine-on-hover press-feedback" type="submit">
              {form.id ? 'Actualizar' : 'Crear'}
            </button>
          </div>
        </form>
      </AdminModalForm>

      <section className="card reveal">
        <div className="table-head">
          <div>Nombre</div>
          <div>Rol</div>
          <div>Estado</div>
          <div>Permisos</div>
          <div>Acciones</div>
        </div>
        <MoraScrollReveal as="div" className="table-body" selector=".table-row" variant="fade-up" stagger={0.05} duration={0.45}>
          {users.length === 0 && <div className="table-row">Sin usuarios.</div>}
          {users.map((user) => (
            <div key={user.id} className="table-row">
              <div className="table-title">{user.fullName}</div>
              <div className="table-sub">{user.roles.join(', ') || 'Sin rol'}</div>
              <div className={`status-badge ${user.active ? 'status-ok' : 'status-warn'}`}>
                {user.active ? 'Activo' : 'Inactivo'}
              </div>
              <div className="table-sub">{user.username}</div>
              <div className="table-actions">
                <button className="icon-btn press-feedback" onClick={() => handleEdit(user)}>
                  EDIT
                </button>
                <button className="icon-btn danger press-feedback" onClick={() => toggleActive(user)}>
                  {user.active ? 'OFF' : 'ON'}
                </button>
                <button className="icon-btn danger press-feedback" onClick={() => setConfirmDelete(user)}>
                  DEL
                </button>
              </div>
            </div>
          ))}
        </MoraScrollReveal>
      </section>

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        title="Eliminar usuario"
        description={
          confirmDelete
            ? `Eliminar a "${confirmDelete.fullName}"? Quedara archivado cómo inactivo.`
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
