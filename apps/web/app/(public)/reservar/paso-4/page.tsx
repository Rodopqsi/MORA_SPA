"use client";

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { clientFetch } from '../../../lib/clientApi';
import { BookingTimeline } from '../BookingTimeline';
import {
  BookingState,
  Service,
  clearBookingState,
  defaultBookingState,
  loadBookingState,
  saveBookingState
} from '../bookingState';
import { apiFetch } from '../../../lib/api';

export default function ReservarPaso4Page() {
  const router = useRouter();
  const [booking, setBooking] = useState<BookingState>(defaultBookingState());
  const [services, setServices] = useState<Service[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const state = loadBookingState();
    if (state.selectedServices.length === 0) {
      router.replace('/reservar/paso-1');
      return;
    }
    if (!state.selectedSlot) {
      router.replace('/reservar/paso-3');
      return;
    }
    setBooking(state);
  }, [router]);

  useEffect(() => {
    apiFetch<{ data: Service[] }>('/public/services')
      .then((res) => setServices(res.data ?? []))
      .catch(() => setServices([]));
  }, []);

  const serviceMap = useMemo(() => {
    return new Map(services.map((service) => [service.id, service]));
  }, [services]);

  const selectedServiceList = booking.selectedServices
    .map((id) => serviceMap.get(id))
    .filter(Boolean) as Service[];

  const totals = selectedServiceList.reduce(
    (acc, service) => {
      const price = Number(service.priceBase);
      return {
        duration: acc.duration + service.durationMin,
        price: acc.price + (Number.isNaN(price) ? 0 : price)
      };
    },
    { duration: 0, price: 0 }
  );

  const updateNotes = (value: string) => {
    const nextState = { ...booking, notes: value };
    setBooking(nextState);
    saveBookingState(nextState);
  };

  const handleReserve = async () => {
    if (!booking.selectedSlot || booking.selectedServices.length === 0) {
      setError('Selecciona servicio y horario.');
      return;
    }

    if (selectedServiceList.length !== booking.selectedServices.length) {
      setError('No se pudo validar el catalogo de servicios. Vuelve al paso 1 e intenta nuevamente.');
      return;
    }

    setSaving(true);
    setError('');
    setNotice('');

    try {
      let cursor = new Date(booking.selectedSlot.start);
      const details = selectedServiceList.map((service) => {
        const start = new Date(cursor);
        cursor = new Date(cursor.getTime() + service.durationMin * 60 * 1000);
        return {
          serviceId: service.id,
          staffId: booking.selectedSlot!.staffId,
          start: start.toISOString()
        };
      });

      await clientFetch('/client-reservations', {
        method: 'POST',
        body: JSON.stringify({
          notes: booking.notes || undefined,
          details
        })
      });

      setNotice('Reserva creada. Revisa tu cuenta para el detalle.');
      clearBookingState();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear la reserva.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="booking-shell">
      <header className="page-head">
        <div>
          <div className="eyebrow">Reserva online</div>
          <h1>Agenda tu visita</h1>
          <p>Completa cada paso para reservar tu cita.</p>
        </div>
        <div className="page-actions">
          <div className="pill">Paso 4 de 4</div>
        </div>
      </header>

      {notice && <div className="card notice-card">{notice}</div>}
      {error && <div className="auth-error">{error}</div>}

      <section className="card booking-panel">
        <BookingTimeline step={4} />
        <div className="section-head">
          <div>
            <div className="eyebrow">Resumen</div>
            <h2>Tu reserva</h2>
          </div>
        </div>
        <div className="booking-summary">
          <div>
            <div className="booking-title">Servicios</div>
            <div className="booking-sub">
              {selectedServiceList.length > 0
                ? selectedServiceList.map((service) => service.name).join(', ')
                : 'Sin servicios'}
            </div>
          </div>
          <div>
            <div className="booking-title">Duracion total</div>
            <div className="booking-sub">{totals.duration} min</div>
          </div>
          <div>
            <div className="booking-title">Monto estimado</div>
            <div className="booking-sub">S/ {totals.price.toFixed(2)}</div>
          </div>
          <div>
            <div className="booking-title">Horario</div>
            <div className="booking-sub">
              {booking.selectedSlot ? new Date(booking.selectedSlot.start).toLocaleString('es-PE') : 'Sin horario'}
            </div>
          </div>
        </div>
        <div className="auth-form">
          <label>
            Notas para el equipo
            <input
              value={booking.notes}
              onChange={(event) => updateNotes(event.target.value)}
              placeholder="Ejemplo: tono deseado, largo, alergias o preferencia de acabado"
            />
          </label>
        </div>
        <div className="booking-nav">
          <button className="btn btn-outline" type="button" onClick={() => router.push('/reservar/paso-3')}>Atras</button>
          <button className="btn" type="button" onClick={handleReserve} disabled={saving}>
            {saving ? 'Guardando...' : 'Confirmar reserva'}
          </button>
        </div>
      </section>
    </div>
  );
}
