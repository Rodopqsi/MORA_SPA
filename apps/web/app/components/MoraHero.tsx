'use client';

import { ReactNode, useRef } from 'react';
import { ensureGsapRegistered, gsap, MoraDuration, MoraEase, prefersReducedMotion, useGSAP } from '../lib/gsap';

interface MoraHeroProps {
  /** CSS class to identify the element that wraps each animated line. */
  titleSelector?: string;
  /** CSS class for the subtitle / paragraph. */
  subtitleSelector?: string;
  /** CSS class for the call-to-action buttons container. */
  ctaSelector?: string;
  /** CSS class for the floating decorative content (badges, chips, etc.). */
  floatingSelector?: string;
  /** Children to render inside the hero container. */
  children: ReactNode;
  /** Optional extra className for the hero container. */
  className?: string;
}

/**
 * Hero animation preset. On mount it animates the title lines, subtitle, CTA
 * buttons and floating chips with a polished staggered entrance. Designed to
 * co-exist with the existing CSS-based `.page-enter` and `.float-subtle`
 * classes (they target different children).
 */
export function MoraHero({
  titleSelector = '.mora-hero-title-line',
  subtitleSelector = '.mora-hero-subtitle',
  ctaSelector = '.mora-hero-cta',
  floatingSelector = '.mora-hero-floating',
  children,
  className,
}: MoraHeroProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useGSAP(
    () => {
      ensureGsapRegistered();
      const root = containerRef.current;
      if (!root) return;

      if (prefersReducedMotion()) {
        gsap.set(
          [
            root.querySelectorAll(titleSelector),
            root.querySelectorAll(subtitleSelector),
            root.querySelectorAll(ctaSelector),
            root.querySelectorAll(floatingSelector),
          ].flat(),
          { autoAlpha: 1, clearProps: 'transform' }
        );
        return;
      }

      const tl = gsap.timeline({ defaults: { ease: MoraEase.out } });

      const titles = root.querySelectorAll(titleSelector);
      const subtitle = root.querySelector(subtitleSelector);
      const ctas = root.querySelectorAll(ctaSelector);
      const floating = root.querySelectorAll(floatingSelector);

      if (titles.length) {
        tl.from(titles, {
          yPercent: 110,
          autoAlpha: 0,
          duration: MoraDuration.medium,
          stagger: 0.1,
        });
      }

      if (subtitle) {
        tl.from(
          subtitle,
          { y: 18, autoAlpha: 0, duration: MoraDuration.base },
          '-=0.55'
        );
      }

      if (ctas.length) {
        tl.from(
          ctas,
          { y: 18, autoAlpha: 0, duration: MoraDuration.base, stagger: 0.08 },
          '-=0.45'
        );
      }

      if (floating.length) {
        tl.from(
          floating,
          { y: 24, autoAlpha: 0, duration: MoraDuration.base, stagger: 0.08 },
          '-=0.5'
        );
      }
    },
    { scope: containerRef as React.RefObject<HTMLElement>, dependencies: [] }
  );

  return (
    <div ref={containerRef} className={className}>
      {children}
    </div>
  );
}
