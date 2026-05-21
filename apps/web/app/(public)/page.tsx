'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '../lib/api';
import { setToken } from '../lib/auth';

export default function RegistroPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: '', phone: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      await apiFetch(`/client-auth/register`, {
        method: 'POST',
        body: JSON.stringify({
          name: form.name,
          phone: form.phone,
          email: form.email || undefined,
          password: form.password
        })
      });

      const login = await apiFetch<{ token: string }>(`/client-auth/login`, {
        method: 'POST',
        body: JSON.stringify({ phone: form.phone, password: form.password })
      });

      setToken(login.token);
      router.push('/mi-cuenta');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al registrar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <h1>Crea tu cuenta</h1>
        <p>Registra tus datos y agenda con prioridad.</p>
        <form onSubmit={handleSubmit} className="auth-form">
          <label>
            Nombre completo
            <input value={form.name} onChange={(e) => handleChange('name', e.target.value)} placeholder="Tu nombre" />
          </label>
          <label>
            Telefono
            <input value={form.phone} onChange={(e) => handleChange('phone', e.target.value)} placeholder="+51 987 654 321" />
          </label>
          <label>
            Email (opcional)
            <input value={form.email} onChange={(e) => handleChange('email', e.target.value)} placeholder="correo@email.com" />
          </label>
          <label>
            Contrasena
            <input type="password" value={form.password} onChange={(e) => handleChange('password', e.target.value)} />
          </label>
          {error && <div className="auth-error">{error}</div>}
          <button className="btn" disabled={loading} type="submit">
            {loading ? 'Creando...' : 'Crear cuenta'}
          </button>
        </form>
        <div className="auth-footer">
          <span>Ya tienes cuenta?</span>
          <a className="chip" href="/login">Ingresar</a>
        </div>
      </div>
    </div>
  );
}