"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '../../../lib/api';
import { BookingTimeline } from '../BookingTimeline';
import {
  BookingState,
  Staff,
  defaultBookingState,
  loadBookingState,
  saveBookingState
} from '../bookingState';

export default function ReservarPaso2Page() {
  const router = useRouter();
  const [staff, setStaff] = useState<Staff[]>([]);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [booking, setBooking] = useState<BookingState>(defaultBookingState());

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
        setNotice(data.length === 0 ? 'Aun no hay especialistas disponibles para reservas online.' : '');
      })
      .catch(() => {
        setStaff([]);
        setNotice('No se pudo cargar el equipo disponible.');
      });
  }, []);

  const selectStaff = (value: string) => {
    const nextState = { ...booking, selectedStaff: value };
    setBooking(nextState);
    saveBookingState(nextState);
    setError('');
  };

  const goNext = () => {
    router.push('/reservar/paso-3');
  };

  const goBack = () => {
    router.push('/reservar/paso-1');
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
          <div className="pill">Paso 2 de 4</div>
        </div>
      </header>

      {notice && <div className="card notice-card">{notice}</div>}
      {error && <div className="auth-error">{error}</div>}

      <section className="card booking-panel">
        <BookingTimeline step={2} />
        <div className="section-head">
          <div>
            <div className="eyebrow">Paso 2</div>
            <h2>Elige especialista</h2>
          </div>
        </div>
        <div className="chip-row">
          <button
            className={`chip ${booking.selectedStaff === 'any' ? 'chip-active' : ''}`}
            type="button"
            onClick={() => selectStaff('any')}
          >
            Sin preferencia
          </button>
          {staff.map((member) => (
            <button
              key={member.id}
              className={`chip ${booking.selectedStaff === String(member.id) ? 'chip-active' : ''}`}
              type="button"
              onClick={() => selectStaff(String(member.id))}
            >
              {member.name}
            </button>
          ))}
        </div>
        <div className="booking-nav">
          <button className="btn btn-outline" type="button" onClick={goBack}>Atras</button>
          <button className="btn" type="button" onClick={goNext}>Continuar</button>
        </div>
      </section>
    </div>
  );
}
