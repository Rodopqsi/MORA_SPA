'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiFetch } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';

export default function LoginPage() {
  const router = useRouter();
  const search = useSearchParams();
  const { setClientToken } = useAuth();
  const [form, setForm] = useState({ phone: '', email: '', password: '' });
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
      const payload = form.phone ? { phone: form.phone, password: form.password } : { email: form.email, password: form.password };
      const response = await apiFetch<{ token: string }>(`/client-auth/login`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      setClientToken(response.token);
      router.push('/mi-cuenta');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error de ingreso');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell page-enter">
      <div className="auth-card">
        <h1>Ingresa a tu cuenta</h1>
        <p>Reserva, revisa tus citas y accede a promociones exclusivas.</p>
        {sessionExpired && (
          <div className="auth-warning" role="alert">
            Tu sesion expiro por inactividad. Ingresa de nuevo para continuar.
          </div>
        )}
        <form onSubmit={handleSubmit} className="auth-form">
          <label>
            Teléfono
            <input value={form.phone} onChange={(e) => handleChange('phone', e.target.value)} placeholder="+51 987 654 321" />
          </label>
          <label>
            Email (opcional)
            <input value={form.email} onChange={(e) => handleChange('email', e.target.value)} placeholder="correo@email.com" />
          </label>
          <label>
            Contraseña
            <input type="password" value={form.password} onChange={(e) => handleChange('password', e.target.value)} />
          </label>
          {error && <div className="auth-error">{error}</div>}
          <button className="btn shine-on-hover press-feedback" disabled={loading} type="submit">
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>
        <div className="auth-footer">
          <span>Nuevo por aqui?</span>
          <a className="chip" href="/registro">Crear cuenta</a>
        </div>
      </div>
    </div>
  );
}
