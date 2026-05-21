"use client";

import { useEffect, useState } from 'react';
import { staffFetch } from '../../lib/staffApi';

type User = { id: number; username: string; fullName: string; active: boolean; roles: string[] };

export default function UsuariosPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<string[]>([]);
  const [form, setForm] = useState({ username: '', fullName: '', password: '', role: 'RECEPCION' });
  const [roleEdit, setRoleEdit] = useState<Record<number, string>>({});
  const [error, setError] = useState('');

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

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    try {
      await staffFetch('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          username: form.username,
          fullName: form.fullName,
          password: form.password,
          roles: [form.role]
        })
      });
      setForm({ username: '', fullName: '', password: '', role: 'RECEPCION' });
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear');
    }
  };

  const updateRole = async (userId: number) => {
    const role = roleEdit[userId];
    if (!role) return;
    try {
      await staffFetch(`/users/${userId}/roles`, {
        method: 'PUT',
        body: JSON.stringify({ roles: [role] })
      });
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al actualizar');
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
          <button className="btn">Nuevo usuario</button>
        </div>
      </header>

      <section className="card reveal">
        <div className="section-head">
          <div>
            <div className="eyebrow">Nuevo usuario</div>
            <h2>Crear acceso</h2>
          </div>
        </div>
        <form className="auth-form" onSubmit={handleCreate}>
          <label>
            Usuario
            <input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
          </label>
          <label>
            Nombre completo
            <input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
          </label>
          <label>
            Contrasena
            <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
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
          <button className="btn" type="submit">Crear</button>
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
              <div>
                <select
                  className="chip"
                  value={roleEdit[user.id] ?? user.roles[0] ?? 'RECEPCION'}
                  onChange={(e) => setRoleEdit({ ...roleEdit, [user.id]: e.target.value })}
                >
                  {roles.map((role) => (
                    <option key={role} value={role}>{role}</option>
                  ))}
                </select>
              </div>
              <div className={`status-badge ${user.active ? 'status-ok' : 'status-warn'}`}>
                {user.active ? 'Activo' : 'Inactivo'}
              </div>
              <div className="table-sub">{user.username}</div>
              <div className="table-actions">
                <button className="icon-btn" onClick={() => updateRole(user.id)}>OK</button>
                <button className="icon-btn danger" onClick={() => toggleActive(user)}>
                  {user.active ? 'OFF' : 'ON'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
