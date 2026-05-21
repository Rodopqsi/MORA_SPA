import { addMinutes } from 'date-fns';
import { prisma, AppError } from './core';
import { ReservationStatus } from '@prisma/client';

export type TimeInterval = {
  start: Date;
  end: Date;
};

const ACTIVE_STATUSES: ReservationStatus[] = [
  'PENDIENTE_ADELANTO',
  'CONFIRMADA',
  'EN_PROCESO'
];

const DEFAULT_SHIFTS = [
  { start: '09:00', end: '13:00' },
  { start: '16:00', end: '21:00' }
];

const toDayStart = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
const toDayEnd = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);

const timeToDate = (baseDate: Date, time: Date) => {
  return new Date(
    baseDate.getFullYear(),
    baseDate.getMonth(),
    baseDate.getDate(),
    time.getHours(),
    time.getMinutes(),
    time.getSeconds(),
    time.getMilliseconds()
  );
};

const timeStringToDate = (baseDate: Date, value: string) => {
  const [hours, minutes] = value.split(':').map((part) => Number(part));
  return new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), hours, minutes, 0, 0);
};

export const getWorkingIntervals = async (date: Date, staffId?: number): Promise<TimeInterval[]> => {
  const dayOfWeek = date.getDay();

  if (staffId) {
    const staffSchedule = await prisma.staffSchedule.findMany({
      where: { staffId, dayOfWeek, active: true },
      orderBy: { id: 'asc' }
    });

    if (staffSchedule.length > 0) {
      return scheduleToIntervals(date, staffSchedule[0]);
    }
  }

  const salonSchedule = await prisma.salonSchedule.findMany({
    where: { dayOfWeek, active: true },
    orderBy: { id: 'asc' }
  });

  if (salonSchedule.length > 0) {
    return scheduleToIntervals(date, salonSchedule[0]);
  }

  return DEFAULT_SHIFTS.map((shift) => ({
    start: timeStringToDate(date, shift.start),
    end: timeStringToDate(date, shift.end)
  }));
};

const scheduleToIntervals = (
  date: Date,
  schedule: {
    shift1Start: Date;
    shift1End: Date;
    shift2Start: Date | null;
    shift2End: Date | null;
  }
): TimeInterval[] => {
  const intervals: TimeInterval[] = [
    {
      start: timeToDate(date, schedule.shift1Start),
      end: timeToDate(date, schedule.shift1End)
    }
  ];

  if (schedule.shift2Start && schedule.shift2End) {
    intervals.push({
      start: timeToDate(date, schedule.shift2Start),
      end: timeToDate(date, schedule.shift2End)
    });
  }

  return intervals;
};

export const getBusyIntervals = async (
  date: Date,
  staffId: number,
  excludeReservationId?: number
): Promise<TimeInterval[]> => {
  const start = toDayStart(date);
  const end = toDayEnd(date);

  const details = await prisma.reservationDetail.findMany({
    where: {
      staffId,
      start: { lt: end },
      end: { gt: start },
      reservationId: excludeReservationId ? { not: excludeReservationId } : undefined,
      reservation: {
        status: { in: ACTIVE_STATUSES }
      }
    },
    select: { start: true, end: true }
  });

  const blocks = await prisma.agendaBlock.findMany({
    where: {
      start: { lt: end },
      end: { gt: start },
      OR: [{ staffId }, { staffId: null }]
    },
    select: { start: true, end: true }
  });

  return [...details, ...blocks].map((interval) => ({
    start: interval.start,
    end: interval.end
  }));
};

export const overlaps = (a: TimeInterval, b: TimeInterval) => {
  return a.start < b.end && a.end > b.start;
};

export const isWithinWorkingHours = (working: TimeInterval[], start: Date, end: Date) => {
  return working.some((interval) => start >= interval.start && end <= interval.end);
};

export const computeAvailableSlots = (
  working: TimeInterval[],
  busy: TimeInterval[],
  durationMin: number,
  stepMin: number
) => {
  const slots: TimeInterval[] = [];

  for (const interval of working) {
    let cursor = new Date(interval.start.getTime());

    while (addMinutes(cursor, durationMin) <= interval.end) {
      const slotEnd = addMinutes(cursor, durationMin);
      const candidate = { start: new Date(cursor), end: slotEnd };
      const conflict = busy.some((item) => overlaps(candidate, item));
      if (!conflict) {
        slots.push(candidate);
      }
      cursor = addMinutes(cursor, stepMin);
    }
  }

  return slots;
};

export const assertWithinWorkingHours = (working: TimeInterval[], start: Date, end: Date) => {
  if (!isWithinWorkingHours(working, start, end)) {
    throw new AppError(400, 'Outside working hours', 'outside_working_hours');
  }
};
