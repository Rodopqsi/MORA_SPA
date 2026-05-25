"use client";

import { stepItems } from './bookingState';

export function BookingTimeline({ step }: { step: number }) {
  return (
    <div className="booking-timeline">
      {stepItems.map((item) => (
        <div
          key={item.id}
          className={`booking-timeline-step ${step > item.id ? 'done' : step === item.id ? 'active' : ''}`}
        >
          <span className="booking-timeline-dot" />
          <span className="booking-timeline-label">{item.label}</span>
        </div>
      ))}
    </div>
  );
}
