export type Service = { id: number; name: string; durationMin: number; priceBase: string | number };
export type Staff = { id: number; name: string };
export type Availability = { staffId: number; slots: { start: string; end: string }[] };

export type BookingState = {
  selectedServices: number[];
  selectedStaff: string;
  date: string;
  selectedSlot: { staffId: number; start: string } | null;
  notes: string;
};

const STORAGE_KEY = 'bookingState';

export const stepItems = [
  { id: 1, label: 'Servicios' },
  { id: 2, label: 'Especialista' },
  { id: 3, label: 'Horario' },
  { id: 4, label: 'Resumen' }
];

export const defaultBookingState = (): BookingState => ({
  selectedServices: [],
  selectedStaff: 'any',
  date: new Date().toISOString().slice(0, 10),
  selectedSlot: null,
  notes: ''
});

export const loadBookingState = (): BookingState => {
  if (typeof window === 'undefined') return defaultBookingState();
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return defaultBookingState();
  try {
    return { ...defaultBookingState(), ...JSON.parse(raw) } as BookingState;
  } catch {
    return defaultBookingState();
  }
};

export const saveBookingState = (state: BookingState) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};

export const updateBookingState = (patch: Partial<BookingState>) => {
  const next = { ...loadBookingState(), ...patch };
  saveBookingState(next);
  return next;
};

export const clearBookingState = () => {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(STORAGE_KEY);
};
