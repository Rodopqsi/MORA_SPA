'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api';
import MoraScrollReveal from '../../components/MoraScrollReveal';

type Config = {
  id: number;
  businessName: string;
  personType: string;
  docType: string;
  docNumber: string | null;
  requiresAdvance: boolean;
  advanceType: string;
  advanceValue: string | number;
  minAdvanceMinutes: number;
  yapePhone: string;
};

export default function ConfiguracionPage() {
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch('/config')
      .then((res: any) => setConfig(res.data ?? null))
      .catch(() => setError('No se pudo cargar la configuración'))
      .finally(() => setLoading(false));
  }, []);

  const handleChange = (field: keyof Config, value: any) => {
    if (!config) return;
    setConfig({ ...config, [field]: value });
  };

  const handleSave = async () => {
    if (!config) return;
    setSaving(true);
    setMessage('');
    setError('');

    try {
      const res: any = await apiFetch('/config', {
        method: 'PATCH',
        body: JSON.stringify({
          businessName: config.businessName,
          personType: config.personType,
          docType: config.docType,
          docNumber: config.docNumber,
          requiresAdvance: config.requiresAdvance,
          advanceType: config.advanceType,
          advanceValue: Number(config.advanceValue),
          minAdvanceMinutes: Number(config.minAdvanceMinutes),
          yapePhone: config.yapePhone
        })
      });
      setConfig(res.data ?? config);
      setMessage('Configuración guardada correctamente');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="page-enter">
        <div className="eyebrow">Configuración</div>
        <h2 style={{ marginBottom: 18 }}>Ajustes del negocio</h2>
        <div className="card shimmer" style={{ height: 300 }} />
      </div>
    );
  }

  if (!config) {
    return (
      <div className="page-enter">
        <div className="eyebrow">Configuración</div>
        <h2 style={{ marginBottom: 18 }}>Ajustes del negocio</h2>
        <div className="auth-error">No se pudo cargar la configuración.</div>
      </div>
    );
  }

  return (
    <div className="page-enter">
      <div className="eyebrow">Configuración</div>
      <h2 style={{ marginBottom: 18 }}>Ajustes del negocio</h2>

      {message && (
        <div className="shop-drawer-status" style={{ marginBottom: 18 }}>
          <div className="shop-status-icon" style={{ width: 36, height: 36 }} aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div className="shop-status-content">
            <strong>{message}</strong>
          </div>
        </div>
      )}

      {error && <div className="auth-error" style={{ marginBottom: 18 }}>{error}</div>}

      <MoraScrollReveal as="div" selector=".admin-card" variant="fade-up" stagger={0.08}>
        <div className="admin-card card" style={{ maxWidth: 640 }}>
          <h3 style={{ marginBottom: 16 }}>Datos del negocio</h3>
          <div className="form-grid" style={{ display: 'grid', gap: 14 }}>
            <label>
              Razón social / Nombre
              <input
                value={config.businessName}
                onChange={(e) => handleChange('businessName', e.target.value)}
              />
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <label>
                Tipo de persona
                <select
                  value={config.personType}
                  onChange={(e) => handleChange('personType', e.target.value)}
                >
                  <option value="NATURAL">Natural</option>
                  <option value="JURIDICA">Jurídica</option>
                </select>
              </label>
              <label>
                Tipo de documento
                <select
                  value={config.docType}
                  onChange={(e) => handleChange('docType', e.target.value)}
                >
                  <option value="DNI">DNI</option>
                  <option value="RUC">RUC</option>
                  <option value="CE">CE</option>
                </select>
              </label>
            </div>
            <label>
              Número de documento
              <input
                value={config.docNumber ?? ''}
                onChange={(e) => handleChange('docNumber', e.target.value)}
              />
            </label>
          </div>
        </div>

        <div className="admin-card card" style={{ maxWidth: 640, marginTop: 16 }}>
          <h3 style={{ marginBottom: 16 }}>Reservas y pagos</h3>
          <div className="form-grid" style={{ display: 'grid', gap: 14 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={config.requiresAdvance}
                onChange={(e) => handleChange('requiresAdvance', e.target.checked)}
              />
              <span>Requerir adelanto para confirmar reserva</span>
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <label>
                Tipo de adelanto
                <select
                  value={config.advanceType}
                  onChange={(e) => handleChange('advanceType', e.target.value)}
                >
                  <option value="PORCENTAJE">Porcentaje (%)</option>
                  <option value="MONTO">Monto fijo (S/)</option>
                </select>
              </label>
              <label>
                Valor de adelanto
                <input
                  type="number"
                  min={0}
                  value={config.advanceValue}
                  onChange={(e) => handleChange('advanceValue', e.target.value)}
                />
              </label>
            </div>
            <label>
              Minutos mínimos antes de la reserva
              <input
                type="number"
                min={0}
                value={config.minAdvanceMinutes}
                onChange={(e) => handleChange('minAdvanceMinutes', e.target.value)}
              />
            </label>
          </div>
        </div>

        <div className="admin-card card" style={{ maxWidth: 640, marginTop: 16 }}>
          <h3 style={{ marginBottom: 16 }}>Pagos digitales</h3>
          <div className="form-grid" style={{ display: 'grid', gap: 14 }}>
            <label>
              Número de Yape
              <input
                inputMode="numeric"
                pattern="[0-9]+"
                value={config.yapePhone}
                onChange={(e) => handleChange('yapePhone', e.target.value.replace(/\D/g, ''))}
                placeholder="917364262"
              />
              <span style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4, display: 'block' }}>
                Este número se usará para generar el QR de pago en la tienda y reservas.
              </span>
            </label>
          </div>
        </div>

        <div style={{ maxWidth: 640, marginTop: 18 }}>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </MoraScrollReveal>
    </div>
  );
}
