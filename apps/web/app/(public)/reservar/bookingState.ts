export type Service = { id: number; name: string; durationMin: number; priceBase: string | number };
export type BookingAssignment = {
  serviceId: number;
  staffId: number;
  start: string;
  end: string;
};

export type AvailabilitySlot = {
  id: string;
  start: string;
  end: string;
  assignments?: BookingAssignment[];
};

export type Staff = {
  id: number;
  name: string;
  services?: { serviceId: number }[];
};
export type Availability = {
  staffId: number | null;
  label?: string;
  mode?: 'single_staff' | 'multi_staff';
  slots: AvailabilitySlot[];
};

export type AvailabilityMeta = {
  mode: 'single_staff' | 'multi_staff';
  reason: 'SLOTS_FOUND' | 'NO_ACTIVE_STAFF' | 'NO_COMPATIBLE_STAFF' | 'NO_TEAM_COVERAGE' | 'NO_OPEN_SLOTS';
  totalDurationMin: number;
};

export type BookingState = {
  selectedServices: number[];
  selectedStaff: string;
  date: string;
  selectedSlot: {
    id: string;
    staffId: number | null;
    start: string;
    end: string;
    label?: string;
    assignments?: BookingAssignment[];
  } | null;
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
