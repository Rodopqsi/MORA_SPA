'use client';

import { ReactNode, useRef } from 'react';
import { ensureGsapRegistered, gsap, MoraDuration, MoraEase, prefersReducedMotion, ScrollTrigger, useGSAP } from '../lib/gsap';

type RevealVariant = 'fade-up' | 'fade' | 'fade-left' | 'fade-right' | 'scale';

interface MoraScrollRevealProps {
  children: ReactNode;
  /** Selector (scoped to this container) to animate. Defaults to direct children. */
  selector?: string;
  /** Variant of entrance. */
  variant?: RevealVariant;
  /** Extra delay (seconds) before the entrance plays. */
  delay?: number;
  /** Stagger between children, in seconds. */
  stagger?: number;
  /** ScrollTrigger start. Default: "top 85%". */
  start?: string;
  /** When true the animation only fires once. Default: true. */
  once?: boolean;
  /** Duration override. */
  duration?: number;
  /** Extra className passthrough. */
  className?: string;
  /** Element type to render. Default: div. */
  as?: 'div' | 'section' | 'article' | 'header' | 'footer' | 'ul' | 'li';
}

const VARIANT_FROM: Record<RevealVariant, gsap.TweenVars> = {
  'fade-up': { y: 32, autoAlpha: 0 },
  fade: { autoAlpha: 0 },
  'fade-left': { x: -32, autoAlpha: 0 },
  'fade-right': { x: 32, autoAlpha: 0 },
  scale: { scale: 0.94, autoAlpha: 0 },
};

/**
 * Wraps a section (or any container) and fades its children in with a soft
 * staggered entrance when the element scrolls into view.
 *
 * Designed to be a drop-in replacement for the legacy CSS `.stagger-children`
 * animation — it produces the same look with proper per-element reset, smooth
 * interruption handling, and respect for prefers-reduced-motion.
 */
function MoraScrollReveal({
  children,
  selector,
  variant = 'fade-up',
  delay = 0,
  stagger = 0.08,
  start = 'top 85%',
  once = true,
  duration = MoraDuration.base,
  className,
  as: Tag = 'div',
}: MoraScrollRevealProps) {
  const containerRef = useRef<HTMLElement | null>(null);

  useGSAP(
    () => {
      ensureGsapRegistered();
      if (!containerRef.current) return;

      // Resolve target elements now (inside useGSAP) so that children rendered
      // asynchronously (loading states, fetches, etc.) are picked up correctly.
      // Fall back to direct children when no selector is provided.
      const resolveTargets = (): Element[] => {
        const root = containerRef.current!;
        if (selector) {
          return gsap.utils.toArray(selector).filter(
            (el): el is Element => el instanceof Element && root.contains(el)
          );
        }
        return Array.from(root.children);
      };

      const initialTargets = resolveTargets();
      if (initialTargets.length === 0) {
        // No children to animate yet — bail silently. The container may fill
        // in later via state updates, in which case the parent re-mounts or
        // the consumer should provide a `key` to force re-evaluation.
        return;
      }

      if (prefersReducedMotion()) {
        gsap.set(initialTargets, { autoAlpha: 1, clearProps: 'transform' });
        return;
      }

      // If the container is already in the viewport at mount time, the
      // ScrollTrigger start position is "behind" us and may never fire. In
      // that case we animate immediately; otherwise we let ScrollTrigger
      // drive the entrance on scroll.
      const rect = containerRef.current!.getBoundingClientRect();
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
      const alreadyVisible = rect.top < viewportHeight * 0.95 && rect.bottom > 0;

      if (alreadyVisible) {
        gsap.fromTo(
          initialTargets,
          { ...VARIANT_FROM[variant] },
          {
            autoAlpha: 1,
            x: 0,
            y: 0,
            scale: 1,
            duration,
            delay,
            stagger,
            ease: MoraEase.out,
            clearProps: 'transform',
          }
        );
        return;
      }

      gsap.from(initialTargets, {
        ...VARIANT_FROM[variant],
        duration,
        delay,
        stagger,
        ease: MoraEase.out,
        scrollTrigger: {
          trigger: containerRef.current!,
          start,
          once,
        },
      });

      // ScrollTrigger measures positions synchronously on creation. If the
      // container is already in the viewport on mount (very common for
      // above-the-fold content), the trigger fires immediately — but if any
      // async content (images, fonts, data) resizes the container after
      // mount, the trigger may end up "above" the start line and the tween
      // can stall with its `from` state applied. We re-evaluate after layout
      // settles so already-visible elements reliably finish their entrance.
      const refreshTimer = window.setTimeout(() => {
        ScrollTrigger.refresh();
      }, 250);

      return () => {
        window.clearTimeout(refreshTimer);
      };
    },
    { scope: containerRef as React.RefObject<HTMLElement> }
  );

  return (
    // @ts-expect-error — dynamic tag ref typing is fine for our limited union.
    <Tag ref={containerRef} className={className}>
      {children}
    </Tag>
  );
}

export { MoraScrollReveal };
export default MoraScrollReveal;
