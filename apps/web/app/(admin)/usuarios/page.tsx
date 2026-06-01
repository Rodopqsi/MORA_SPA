"use client";

import { useEffect, useRef, useState } from 'react';
import { staffFetch } from '../../lib/staffApi';
import { normalizePersonName } from '../../lib/validation';

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
  const formRef = useRef<HTMLDivElement>(null);

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
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleDelete = async (user: User) => {
    const confirmed = window.confirm(`Eliminar a ${user.fullName}? Quedara archivado como inactivo.`);
    if (!confirmed) return;

    setError('');
    try {
      await staffFetch(`/users/${user.id}`, { method: 'DELETE' });
      if (form.id === user.id) {
        resetForm();
      }
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar');
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
    <div className="page-stack">
      <header className="page-head">
        <div>
          <div className="eyebrow">Control de usuarios</div>
          <h1>Accesos con estilo y seguridad</h1>
          <p>Gestiona roles, permisos y accesos desde un solo lugar.</p>
        </div>
        <div className="page-actions">
          <button className="btn" onClick={() => {
            resetForm();
            formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }}>
            Nuevo usuario
          </button>
        </div>
      </header>

      <section className="card reveal" ref={formRef}>
        <div className="section-head">
          <div>
            <div className="eyebrow">{form.id ? 'Editar usuario' : 'Nuevo usuario'}</div>
            <h2>{form.id ? 'Actualizar acceso' : 'Crear acceso'}</h2>
          </div>
          <button className="chip" type="button" onClick={resetForm}>Limpiar</button>
        </div>
        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            Usuario
            <input required value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
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
            Contrasena
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
                <option key={role} value={role}>{role}</option>
              ))}
            </select>
          </label>
          {error && <div className="auth-error">{error}</div>}
          <button className="btn" type="submit">{form.id ? 'Actualizar' : 'Crear'}</button>
        </form>
      </section>

      <section className="card reveal">
        <div className="table-head">
          <div>Nombre</div>
          <div>Rol</div>
          <div>Estado</div>
          <div>Permisos</div>
          <div>Acciones</div>
        </div>
        <div className="table-body">
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
                <button className="icon-btn" onClick={() => handleEdit(user)}>EDIT</button>
                <button className="icon-btn danger" onClick={() => toggleActive(user)}>
                  {user.active ? 'OFF' : 'ON'}
                </button>
                <button className="icon-btn danger" onClick={() => handleDelete(user)}>DEL</button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
