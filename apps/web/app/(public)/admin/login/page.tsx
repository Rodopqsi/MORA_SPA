'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiFetch } from '../../../lib/api';
import { useAuth } from '../../../context/AuthContext';

export default function AdminLoginPage() {
  const router = useRouter();
  const search = useSearchParams();
  const { setStaffToken } = useAuth();
  const [form, setForm] = useState({ username: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const sessionExpired = search.get('expired') === '1';

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await apiFetch<{ token: string }>(`/auth/login`, {
        method: 'POST',
        body: JSON.stringify({
          username: form.username,
          password: form.password
        })
      });
      setStaffToken(response.token);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error de ingreso');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <h1>Ingreso administrativo</h1>
        <p>Acceso exclusivo para el equipo Mora.</p>
        {sessionExpired && (
          <div className="auth-warning" role="alert">
            Tu sesion expiro por inactividad. Ingresa de nuevo para continuar.
          </div>
        )}
        <form onSubmit={handleSubmit} className="auth-form">
          <label>
            Usuario
            <input value={form.username} onChange={(e) => handleChange('username', e.target.value)} />
          </label>
          <label>
            Contrasena
            <input type="password" value={form.password} onChange={(e) => handleChange('password', e.target.value)} />
          </label>
          {error && <div className="auth-error">{error}</div>}
          <button className="btn" disabled={loading} type="submit">
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  );
}
