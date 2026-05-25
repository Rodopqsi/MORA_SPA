"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '../../../lib/api';
import { BookingTimeline } from '../BookingTimeline';
import {
  BookingState,
  Service,
  defaultBookingState,
  loadBookingState,
  saveBookingState
} from '../bookingState';

export default function ReservarPaso1Page() {
  const router = useRouter();
  const [services, setServices] = useState<Service[]>([]);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [booking, setBooking] = useState<BookingState>(defaultBookingState());

  useEffect(() => {
    setBooking(loadBookingState());
  }, []);

  useEffect(() => {
    apiFetch<{ data: Service[] }>('/public/services')
      .then((res) => {
        const data = res.data ?? [];
        setServices(data);
        setNotice(data.length === 0 ? 'Aun no hay servicios publicados para reservas online.' : '');
      })
      .catch(() => {
        setServices([]);
        setNotice('No se pudo cargar el catalogo en este momento.');
      });
  }, []);

  const toggleService = (serviceId: number) => {
    const next = booking.selectedServices.includes(serviceId)
      ? booking.selectedServices.filter((id) => id !== serviceId)
      : [...booking.selectedServices, serviceId];
    const nextState = {
      ...booking,
      selectedServices: next,
      selectedSlot: null
    };
    setBooking(nextState);
    saveBookingState(nextState);
    setError('');
  };

  const goNext = () => {
    if (booking.selectedServices.length === 0) {
      setError('Selecciona al menos un servicio.');
      return;
    }
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
          <div className="pill">Paso 1 de 4</div>
        </div>
      </header>

      {notice && <div className="card notice-card">{notice}</div>}
      {error && <div className="auth-error">{error}</div>}

      <section className="card booking-panel">
        <BookingTimeline step={1} />
        <div className="section-head">
          <div>
            <div className="eyebrow">Paso 1</div>
            <h2>Selecciona tus servicios</h2>
          </div>
        </div>
        <div className="booking-list">
          {services.length === 0 && <div className="list-sub">Sin servicios disponibles.</div>}
          {services.map((service) => (
            <label key={service.id} className={`booking-item ${booking.selectedServices.includes(service.id) ? 'active' : ''}`}>
              <input
                type="checkbox"
                checked={booking.selectedServices.includes(service.id)}
                onChange={() => toggleService(service.id)}
              />
              <div>
                <div className="booking-title">{service.name}</div>
                <div className="booking-sub">{service.durationMin} min</div>
              </div>
              <div className="booking-price">S/ {service.priceBase}</div>
            </label>
          ))}
        </div>
        <div className="booking-nav">
          <div />
          <button className="btn" type="button" onClick={goNext}>Continuar</button>
        </div>
      </section>
    </div>
  );
}
