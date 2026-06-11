"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { clientFetch } from '../../../lib/clientApi';
import { apiFetch } from '../../../lib/api';
import { BookingTimeline } from '../BookingTimeline';
import { BookingState, loadBookingState, clearBookingState } from '../bookingState';

type YapeMode = 'qr' | 'code';

export default function ReservarPaso5Page() {
  const router = useRouter();
  const params = useSearchParams();
  const reservationIdParam = params.get('reservationId');
  const reservationId = reservationIdParam ? Number(reservationIdParam) : null;

  const [booking, setBooking] = useState<BookingState | null>(null);
  const [reservation, setReservation] = useState<any | null>(null);
  const [config, setConfig] = useState<any | null>(null);
  const [method, setMethod] = useState<'PASARELA' | 'YAPE' | 'EFECTIVO'>('PASARELA');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [showYapeForm, setShowYapeForm] = useState(false);
  const [yapeMode, setYapeMode] = useState<YapeMode>('qr');
  const [yapeReference, setYapeReference] = useState('');
  const [yapeReceipt, setYapeReceipt] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [cardNumber, setCardNumber] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [cardExpMonth, setCardExpMonth] = useState('');
  const [cardExpYear, setCardExpYear] = useState('');
  const [clientEmail, setClientEmail] = useState<string>('');

  useEffect(() => {
    const state = loadBookingState();
    setBooking(state);
  }, []);

  useEffect(() => {
    if (!reservationId) return;

    clientFetch('/client-reservations')
      .then((res: any) => {
        const found = (res.data || []).find((r: any) => Number(r.id) === reservationId);
        setReservation(found ?? null);
      })
      .catch(() => setReservation(null));

    apiFetch('/public/business-config')
      .then((res: any) => setConfig(res.data ?? null))
      .catch(() => setConfig(null));

    clientFetch('/client-auth/me')
      .then((res: any) => {
        const data = res?.data ?? res;
        if (data?.email) setClientEmail(String(data.email));
      })
      .catch(() => undefined);
  }, [reservationId]);

  const total = useMemo(() => {
    if (!reservation?.details?.length) return 0;
    return reservation.details.reduce((acc: number, d: any) => acc + Number(d.subtotal ?? 0), 0);
  }, [reservation]);

  const deposit = useMemo(() => {
    if (!config) return 0;
    try {
      if (String(config.advanceType) === 'PORCENTAJE') {
        const pct = Number(config.advanceValue ?? 30);
        return (total * pct) / 100;
      }
      return Number(config.advanceValue ?? 0);
    } catch (err) {
      return 0;
    }
  }, [config, total]);

  const advancePercent = useMemo(() => {
    if (!config) return 0;
    if (String(config.advanceType) === 'PORCENTAJE') {
      return Number(config.advanceValue ?? 0);
    }
    if (total > 0) {
      return Math.round((deposit / total) * 100);
    }
    return 0;
  }, [config, total, deposit]);

  // QR generado dinamicamente: codifica un payload con el codigo de reserva y el monto.
  const qrSrc = useMemo(() => {
    const code = reservation?.code ?? reservationId ?? 'MORA';
    const amount = Number(deposit || 0).toFixed(2);
    const payload = [
      'YAPE',
      `Reserva:${code}`,
      `Monto:S/${amount}`,
      'Concepto:Adelanto de reserva'
    ].join('|');
    const encoded = encodeURIComponent(payload);
    return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=8&bgcolor=ffffff&color=9b3f5d&data=${encoded}`;
  }, [reservation, reservationId, deposit]);

  const handleReceiptChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setError('La imagen debe pesar menos de 2 MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setYapeReceipt(typeof reader.result === 'string' ? reader.result : null);
      setError('');
    };
    reader.readAsDataURL(file);
  };

  const clearReceipt = () => {
    setYapeReceipt(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handlePay = async () => {
    if (!reservationId) return;
    setSubmitting(true);
    setError('');

    try {
      let reference: string | undefined;

      if (method === 'PASARELA') {
        if (!cardNumber || !cardCvv || !cardExpMonth || !cardExpYear) {
          setError('Ingresa los datos de tarjeta');
          setSubmitting(false);
          return;
        }

        // El navegador no puede llamar directo a Culqi (CORS bloqueado).
        // Pedimos al backend que tokenice la tarjeta y nos devuelva el id.
        const tokenResp: any = await apiFetch('/public/culqi/token', {
          method: 'POST',
          body: JSON.stringify({
            card_number: cardNumber,
            cvv: cardCvv,
            expiration_month: cardExpMonth,
            expiration_year: cardExpYear,
            email: clientEmail || reservation?.client?.email || undefined
          })
        });

        const tokenId = tokenResp?.data?.id;
        if (!tokenId) {
          throw new Error('No se pudo generar el token de la tarjeta');
        }

        reference = tokenId;
      }

      if (method === 'YAPE') {
        setShowYapeForm(true);
        setSubmitting(false);
        return;
      }

      const payload: any = {
        type: 'ADELANTO',
        method,
        amount: deposit,
        reference
      };

      await clientFetch(`/client-reservations/${reservationId}/payments`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      clearBookingState();
      router.push('/mi-cuenta');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al procesar el pago');
    } finally {
      setSubmitting(false);
    }
  };

  const confirmYapePayment = async () => {
    if (!reservationId) return;
    if (yapeMode === 'code' && !yapeReference.trim()) {
      setError('Ingresa el codigo de aprobacion de Yape');
      return;
    }
    if (yapeMode === 'qr' && !yapeReceipt) {
      setError('Adjunta la captura del pago para confirmar');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const payload: any = {
        type: 'ADELANTO',
        method: 'YAPE',
        amount: deposit,
        status: 'CONFIRMADO'
      };

      if (yapeMode === 'qr') {
        payload.reference = yapeReceipt ?? undefined;
        payload.notes = 'Pago Yape confirmado con comprobante adjunto';
      } else {
        payload.reference = yapeReference.trim();
        payload.notes = 'Pago Yape confirmado con codigo de aprobacion';
      }

      await clientFetch(`/client-reservations/${reservationId}/payments`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      clearBookingState();
      router.push('/mi-cuenta');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al confirmar el pago');
    } finally {
      setSubmitting(false);
    }
  };

  if (!reservationId) {
    return <div className="booking-shell"><div className="card">Reserva invalida.</div></div>;
  }

  return (
    <div className="booking-shell page-enter">
      <header className="page-head">
        <div>
          <div className="eyebrow">Reserva online</div>
          <h1>Pagar adelanto</h1>
          <p>Realiza el pago del adelanto para confirmar tu cita.</p>
        </div>
        <div className="page-actions">
          <div className="pill pulse-glow">Paso 5 de 5</div>
        </div>
      </header>

      <section className="card booking-panel">
        <BookingTimeline step={5} />

        {reservation ? (
          <div>
            <div className="section-head">
              <div>
                <div className="eyebrow">Resumen</div>
                <h2>Reserva #{reservation.code}</h2>
              </div>
            </div>

            <div className="booking-summary">
              <div>
                <div className="booking-title">Servicios</div>
                <div className="booking-sub">{reservation.details.map((d: any) => d.service?.name ?? d.serviceId).join(', ')}</div>
              </div>
              <div>
                <div className="booking-title">Monto total</div>
                <div className="booking-sub">S/ {Number(total).toFixed(2)}</div>
              </div>
              <div>
                <div className="booking-title">Adelanto</div>
                <div className="booking-sub">S/ {Number(deposit).toFixed(2)}</div>
              </div>
            </div>

            <div className="auth-form">
              <label>
                Metodo de pago
                <select
                  value={method}
                  onChange={(e) => {
                    setMethod(e.target.value as any);
                    setShowYapeForm(false);
                    setError('');
                  }}
                >
                  <option value="PASARELA">Tarjeta / Pasarela</option>
                  <option value="YAPE">Yape</option>
                  <option value="EFECTIVO">Pago al llegar</option>
                </select>
              </label>

              {method === 'PASARELA' && (
                <div className="card-fields">
                  <label>
                    Numero de tarjeta
                    <input value={cardNumber} onChange={(e) => setCardNumber(e.target.value)} placeholder="Numero" />
                  </label>
                  <label>
                    CVV
                    <input value={cardCvv} onChange={(e) => setCardCvv(e.target.value)} placeholder="CVV" />
                  </label>
                  <label>
                    Mes
                    <input value={cardExpMonth} onChange={(e) => setCardExpMonth(e.target.value)} placeholder="MM" />
                  </label>
                  <label>
                    Ano
                    <input value={cardExpYear} onChange={(e) => setCardExpYear(e.target.value)} placeholder="YYYY" />
                  </label>
                </div>
              )}

              {method === 'YAPE' && showYapeForm && (
                <div className="yape-card">
                  <div className="yape-head">
                    <div className="yape-head-left">
                      <div className="eyebrow">Pago con Yape</div>
                      <h3>Reserva #{reservation.code}</h3>
                    </div>
                    <div className="yape-amount">
                      <span className="yape-amount-label">Monto a pagar</span>
                      <strong>S/ {Number(deposit).toFixed(2)}</strong>
                      {advancePercent > 0 && (
                        <span className="yape-amount-note">
                          {advancePercent}% del total
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="yape-toggle" role="tablist" aria-label="Modo de pago Yape">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={yapeMode === 'qr'}
                      className={`yape-toggle-btn ${yapeMode === 'qr' ? 'is-active' : ''}`}
                      onClick={() => { setYapeMode('qr'); setError(''); }}
                    >
                      Escanear QR
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={yapeMode === 'code'}
                      className={`yape-toggle-btn ${yapeMode === 'code' ? 'is-active' : ''}`}
                      onClick={() => { setYapeMode('code'); setError(''); }}
                    >
                      Codigo de aprobacion
                    </button>
                  </div>

                  {yapeMode === 'qr' ? (
                    <div className="yape-qr-wrap">
                      <div className="yape-qr">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={qrSrc} alt={`Codigo QR de Yape por S/ ${Number(deposit).toFixed(2)}`} />
                      </div>
                      <ol className="yape-steps">
                        <li>Abre Yape en tu celular y elige <strong>Pagar con QR</strong>.</li>
                        <li>Escanea el codigo y envia exactamente <strong>S/ {Number(deposit).toFixed(2)}</strong>.</li>
                        <li>Toma una captura del comprobante y adjuntala aqui para confirmar.</li>
                      </ol>

                      <div className="yape-upload">
                        <label className="yape-upload-btn">
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleReceiptChange}
                            hidden
                          />
                          {yapeReceipt ? 'Cambiar captura' : 'Adjuntar captura'}
                        </label>
                        {yapeReceipt && (
                          <div className="yape-preview">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={yapeReceipt} alt="Comprobante Yape" />
                            <button type="button" className="yape-preview-remove" onClick={clearReceipt}>
                              Quitar
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="yape-code-wrap">
                      <p className="yape-code-hint">
                        En Yape entra a <strong>Aprobar compras</strong> y genera un codigo.
                        Pegalo aqui para validar el pago automaticamente.
                      </p>
                      <label>
                        Codigo de aprobacion
                        <input
                          value={yapeReference}
                          onChange={(e) => setYapeReference(e.target.value)}
                          placeholder="Ej: 482915"
                          inputMode="numeric"
                        />
                      </label>
                    </div>
                  )}

                  {notice && <div className="card notice-card">{notice}</div>}
                  {error && <div className="auth-error">{error}</div>}

                  <div className="booking-nav">
                    <button
                      className="btn btn-outline"
                      type="button"
                      onClick={() => {
                        setShowYapeForm(false);
                        setYapeReference('');
                        clearReceipt();
                        setError('');
                      }}
                    >
                      Volver
                    </button>
                    <button
                      className="btn"
                      type="button"
                      onClick={confirmYapePayment}
                      disabled={submitting}
                    >
                      {submitting ? 'Procesando...' : 'Confirmar pago'}
                    </button>
                  </div>
                </div>
              )}

              {method !== 'YAPE' && notice && <div className="card notice-card">{notice}</div>}
              {method !== 'YAPE' && error && <div className="auth-error">{error}</div>}

              {!showYapeForm && (
                <div className="booking-nav">
                  <button className="btn btn-outline" type="button" onClick={() => router.push('/reservar/paso-4')}>Atras</button>
                  <button className="btn" type="button" onClick={handlePay} disabled={submitting}>
                    {submitting ? 'Procesando...' : `Pagar S/ ${Number(deposit).toFixed(2)}`}
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="card">Cargando reserva...</div>
        )}
      </section>
    </div>
  );
}
