"use client";

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '../../../lib/api';
import { clientFetch } from '../../../lib/clientApi';
import { BookingTimeline } from '../BookingTimeline';
import {
  Availability,
  BookingState,
  Staff,
  defaultBookingState,
  loadBookingState,
  saveBookingState
} from '../bookingState';

export default function ReservarPaso3Page() {
  const router = useRouter();
  const [booking, setBooking] = useState<BookingState>(defaultBookingState());
  const [staff, setStaff] = useState<Staff[]>([]);
  const [slots, setSlots] = useState<Availability[]>([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  // Carga estado inicial una sola vez
  useEffect(() => {
    const state = loadBookingState();
    if (state.selectedServices.length === 0) {
      router.replace('/reservar/paso-1');
      return;
    }
    setBooking(state);
  }, [router]);

  useEffect(() => {
    apiFetch<{ data: Staff[] }>('/public/staff')
      .then((res) => {
        const data = res.data ?? [];
        setStaff(data);
        setNotice(data.length === 0 ? 'Aun no hay especialistas habilitados para la agenda online.' : '');
      })
      .catch(() => {
        setStaff([]);
        setError('No se pudo cargar el equipo disponible.');
      });
  }, []);

  useEffect(() => {
    if (booking.selectedServices.length === 0 || staff.length === 0) {
      setSlots([]);
      return;
    }

    const params = new URLSearchParams();
    params.set('date', booking.date);
    params.set('serviceIds', booking.selectedServices.join(','));
    if (booking.selectedStaff !== 'any') {
      params.set('staffId', booking.selectedStaff);
    }

    setLoading(true);
    clientFetch<{ data: Availability[] }>(`/client-availability?${params.toString()}`)
      .then((res) => {
        const data = res.data ?? [];
        if (data.length === 0) {
          setSlots([]);
          setNotice('No hay horarios disponibles para la fecha elegida.');
        } else {
          setSlots(data);
          setNotice('');
        }
      })
      .catch(() => {
        setError('No se pudo cargar disponibilidad.');
      })
      .finally(() => setLoading(false));

  }, [booking.date, booking.selectedServices, booking.selectedStaff, staff]);

  const staffMap = useMemo(
    () => new Map(staff.map((member) => [member.id, member])),
    [staff]
  );

  const selectSlot = (staffId: number, start: string) => {
    const nextState = { ...booking, selectedSlot: { staffId, start } };
    setBooking(nextState);
    saveBookingState(nextState);
    setError('');
  };

  const updateDate = (value: string) => {
    const nextState = { ...booking, date: value, selectedSlot: null };
    setBooking(nextState);
    saveBookingState(nextState);
  };

  const goNext = () => {
    if (!booking.selectedSlot) {
      setError('Selecciona un horario para continuar.');
      return;
    }
    router.push('/reservar/paso-4');
  };

  const goBack = () => {
    router.push('/reservar/paso-2');
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
          <div className="pill">Paso 3 de 4</div>
        </div>
      </header>

      {notice && <div className="card notice-card">{notice}</div>}
      {error && <div className="auth-error">{error}</div>}

      <section className="card booking-panel">
        <BookingTimeline step={3} />
        <div className="section-head">
          <div>
            <div className="eyebrow">Paso 3</div>
            <h2>Fecha y horario</h2>
          </div>
          <input
            type="date"
            className="chip"
            value={booking.date}
            onChange={(event) => updateDate(event.target.value)}
          />
        </div>

        {loading && <div className="list-sub">Buscando disponibilidad...</div>}
        {!loading && slots.length === 0 && (
          <div className="list-sub">
            {staff.length === 0
              ? 'Aun no hay especialistas disponibles.'
              : notice || 'No hay horarios disponibles para la fecha elegida.'}
          </div>
        )}

        <div className="booking-slot-grid">
          {slots.flatMap((entry) =>
            entry.slots.map((slot) => (
              <button
                key={`${entry.staffId}-${slot.start}`}
                type="button"
                className={`booking-slot ${
                  booking.selectedSlot?.start === slot.start &&
                  booking.selectedSlot?.staffId === entry.staffId
                    ? 'active'
                    : ''
                }`}
                onClick={() => selectSlot(entry.staffId, slot.start)}
              >
                <div className="booking-title">
                  {new Date(slot.start).toLocaleTimeString('es-PE', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
                <div className="booking-sub">
                  {staffMap.get(entry.staffId)?.name ?? 'Equipo'}
                </div>
              </button>
            ))
          )}
        </div>

        <div className="booking-nav">
          <button className="btn btn-outline" type="button" onClick={goBack}>
            Atras
          </button>
          <button className="btn" type="button" onClick={goNext}>
            Continuar
          </button>
        </div>
      </section>
    </div>
  );
}