'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiFetch } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { normalizePhone } from '../../lib/validation';

function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const { setClientToken } = useAuth();
  const [form, setForm] = useState({ phone: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const sessionExpired = search.get('expired') === '1';

  const handleChange = (field: string, value: string) => {
    const next = field === 'phone' ? normalizePhone(value) : value;
    setForm((prev) => ({ ...prev, [field]: next }));
  };

  const translateError = (message: string): string => {
    const map: Record<string, string> = {
      'Invalid credentials': 'Teléfono o contraseña incorrectos. Verifica tus datos.',
      'invalid_credentials': 'Teléfono o contraseña incorrectos. Verifica tus datos.',
      'Request failed': 'No pudimos conectar con el servidor. Intenta de nuevo.',
      'No auth token': 'Tu sesión expiró. Ingresa de nuevo.',
      'token_expired': 'Tu sesión expiró. Ingresa de nuevo.',
      'invalid_token': 'Tu sesión no es válida. Ingresa de nuevo.',
    };
    return map[message] ?? message;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    if (form.phone.length !== 9) {
      setError('Ingresa un celular válido de 9 dígitos (ej: 987654321)');
      setLoading(false);
      return;
    }
    if (form.password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      setLoading(false);
      return;
    }

    try {
      const payload = { phone: form.phone, password: form.password };
      const response = await apiFetch<{ token: string }>(`/client-auth/login`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      setClientToken(response.token);
      // Forzar full reload para que el middleware y el estado de auth se sincronicen correctamente
      window.location.href = '/mi-cuenta';
    } catch (err) {
      const raw = err instanceof Error ? err.message : 'Error de ingreso';
      setError(translateError(raw));
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
            Celular (9 digitos)
            <input
              required
              inputMode="numeric"
              pattern="[0-9]{9}"
              maxLength={9}
              value={form.phone}
              onChange={(e) => handleChange('phone', e.target.value)}
              placeholder="987 654 321"
            />
          </label>
          <label>
            Email (opcional)
            <input value={form.email} onChange={(e) => handleChange('email', e.target.value)} placeholder="correo@email.com" />
          </label>
          <label>
            Contraseña
            <input
              type="password"
              required
              minLength={6}
              value={form.password}
              onChange={(e) => handleChange('password', e.target.value)}
              placeholder="Mínimo 6 caracteres"
            />
          </label>
          {error && <div className="auth-error">{error}</div>}
          <button className="btn shine-on-hover press-feedback" disabled={loading} type="submit" style={{ fontSize: '17px', padding: '14px 32px', fontWeight: 700, letterSpacing: '0.3px' }}>
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

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="auth-shell page-enter"><div className="auth-card"><p>Cargando...</p></div></div>}>
      <LoginForm />
    </Suspense>
  );
}
