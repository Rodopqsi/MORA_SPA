"use client";

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '../../../lib/api';
import { BookingTimeline } from '../BookingTimeline';
import MoraScrollReveal from '../../../components/MoraScrollReveal';
import {
  Availability,
  AvailabilityMeta,
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
  const [meta, setMeta] = useState<AvailabilityMeta | null>(null);
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
        setNotice(data.length === 0 ? 'Aún no hay especialistas habilitados para la agenda online.' : '');
      })
      .catch(() => {
        setStaff([]);
        setError('No se pudo cargar el equipo disponible.');
      });
  }, []);

  useEffect(() => {
    if (booking.selectedServices.length === 0 || staff.length === 0) {
      setSlots([]);
      setMeta(null);
      return;
    }

    const params = new URLSearchParams();
    params.set('date', booking.date);
    params.set('serviceIds', booking.selectedServices.join(','));
    if (booking.selectedStaff !== 'any') {
      params.set('staffId', booking.selectedStaff);
    }

    setLoading(true);
    apiFetch<{ data: Availability[]; meta: AvailabilityMeta }>(`/public/availability?${params.toString()}`)
      .then((res) => {
        const data = res.data ?? [];
        setMeta(res.meta ?? null);
        if (data.length === 0) {
          setSlots([]);
          if (res.meta?.reason === 'NO_COMPATIBLE_STAFF') {
            setNotice('El especialista elegido no puede cubrir todos los servicios seleccionados. Cambia de especialista o usa sin preferencia.');
          } else if (res.meta?.reason === 'NO_TEAM_COVERAGE') {
            setNotice('No hay personal suficiente para cubrir la combinacion elegida. Prueba otra combinacion o separa la reserva.');
          } else if (res.meta?.reason === 'NO_ACTIVE_STAFF') {
            setNotice('Aún no hay especialistas habilitados para la agenda online.');
          } else {
            setNotice('No hay horarios disponibles para la fecha elegida.');
          }
        } else {
          setSlots(data);
          setNotice(
            res.meta?.mode === 'multi_staff'
              ? 'Se encontro una secuencia continua con varios especialistas para cubrir toda tu reserva.'
              : ''
          );
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

  const selectSlot = (entry: Availability, slot: Availability['slots'][number]) => {
    const nextState = {
      ...booking,
      selectedSlot: {
        id: slot.id,
        staffId: entry.staffId,
        start: slot.start,
        end: slot.end,
        label: entry.label,
        assignments: slot.assignments
      }
    };
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
    <div className="booking-shell page-enter">
      <header className="page-head">
        <div>
          <div className="eyebrow">Reserva online</div>
          <h1>Agenda tu visita</h1>
          <p>Completa cada paso para reservar tu cita.</p>
        </div>
        <div className="page-actions">
          <div className="pill pulse-glow">Paso 3 de 5</div>
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

        <div className="list-sub">
          {meta?.mode === 'multi_staff'
            ? 'Se mostraran bloques continuos y, cuándo haga falta, una secuencia automatica con varios especialistas.'
            : 'Se mostraran bloques continuos según la duracion total de tus servicios.'}
        </div>

        {loading && <div className="list-sub">Buscando disponibilidad...</div>}
        {!loading && slots.length === 0 && (
          <div className="list-sub">
            {staff.length === 0
              ? 'Aún no hay especialistas disponibles.'
              : notice || 'No hay horarios disponibles para la fecha elegida.'}
          </div>
        )}

        <MoraScrollReveal as="div" className="booking-slot-grid" selector=".booking-slot" variant="fade-up" stagger={0.05} duration={0.5}>
          {slots.flatMap((entry) =>
            entry.slots.map((slot) => (
              <button
                key={slot.id}
                type="button"
                className={`booking-slot lift-on-hover ${
                  booking.selectedSlot?.id === slot.id
                    ? 'active'
                    : ''
                }`}
                onClick={() => selectSlot(entry, slot)}
              >
                <div className="booking-title">
                  {new Date(slot.start).toLocaleTimeString('es-PE', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}{' '}
                  -{' '}
                  {new Date(slot.end).toLocaleTimeString('es-PE', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
                <div className="booking-sub">
                  {entry.mode === 'multi_staff'
                    ? entry.label ?? 'Equipo asignado'
                    : staffMap.get(entry.staffId ?? -1)?.name ?? entry.label ?? 'Equipo'}
                </div>
              </button>
            ))
          )}
        </MoraScrollReveal>

        <div className="booking-nav">
          <button className="btn btn-outline press-feedback" type="button" onClick={goBack}>
            Atras
          </button>
          <button className="btn shine-on-hover press-feedback" type="button" onClick={goNext}>
            Continuar
          </button>
        </div>
      </section>
    </div>
  );
}