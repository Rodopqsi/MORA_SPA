'use client';

import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';

let registered = false;

/**
 * Registers GSAP plugins once on the client. Safe to call from any client
 * component or hook — subsequent invocations are a no-op.
 */
export function ensureGsapRegistered(): void {
  if (registered || typeof window === 'undefined') {
    return;
  }
  gsap.registerPlugin(ScrollTrigger, useGSAP);
  registered = true;
}

export { gsap, ScrollTrigger, useGSAP };

/**
 * Mora brand easings. Keep these in sync with the CSS cubic-beziers
 * used throughout the web app (globals.css).
 */
export const MoraEase = {
  out: 'power3.out',
  inOut: 'power3.inOut',
  smooth: 'power2.out',
  back: 'back.out(1.4)',
  soft: 'sine.inOut',
} as const;

/**
 * Mora brand durations in seconds. Tuned to feel premium but never slow.
 */
export const MoraDuration = {
  micro: 0.2,
  short: 0.4,
  base: 0.7,
  medium: 1.0,
  long: 1.4,
} as const;

/**
 * Returns true when the user has requested reduced motion at the OS level.
 * Always pair GSAP animations with this check.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
