"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { apiFetch, resolveUploadUrl } from '../lib/api';
import { CatalogProduct, getProductCover } from '../lib/shopCart';
import { ensureGsapRegistered, gsap, MoraDuration, MoraEase, prefersReducedMotion } from '../lib/gsap';
import { MoraScrollReveal } from '../components/MoraScrollReveal';
import { MoraHero } from '../components/MoraHero';

type ServiceImage = { url: string; isCover?: boolean };
type Service = {
  id: number;
  name: string;
  description?: string | null;
  priceBase: string | number;
  durationMin: number;
  images?: ServiceImage[];
};
type Staff = { id: number; name: string; role?: string | null; avatarUrl?: string | null; services?: { service: { name: string } }[] };

const heroSlides = [
  {
    badge: 'Mora signature',
    title: 'Color, corte y cuidado en una sola experiencia',
    subtitle: 'Reserva online, elige a tu especialista y llega a tu cita con todo coordinado desde tu cuenta.',
    image: '/assets/img35mej.jpg'
  },
  {
    badge: 'Agenda inteligente',
    title: 'Horarios reales según servicios, staff y disponibilidad',
    subtitle: 'El sistema cruza duraciones y equipo activo para mostrar solo slots realmente reservables.',
    image: '/assets/img24mej.jpg'
  },
  {
    badge: 'Cuidado continuo',
    title: 'Resultados que se ven bien hoy y se mantienen despues',
    subtitle: 'Desde barberia y color hasta nails y tratamientos, cada visita parte de un diagnostico claro.',
    image: '/assets/img18mej.jpg'
  }
] as const;

const galleryImages = [
  '/assets/img1.jpeg',
  '/assets/img7.jpeg',
  '/assets/img9.jpeg',
  '/assets/img14.jpeg',
  '/assets/img22.jpeg',
  '/assets/img27.jpeg'
];

export default function PublicHomePage() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [services, setServices] = useState<Service[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [products, setProducts] = useState<CatalogProduct[]>([]);

  const heroBgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    ensureGsapRegistered();
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev === heroSlides.length - 1 ? 0 : prev + 1));
    }, 6500);

    return () => clearInterval(timer);
  }, []);

  // Smooth cross-fade + content shift when the slide changes.
  useEffect(() => {
    ensureGsapRegistered();
    const bg = heroBgRef.current;
    const content = document.querySelector<HTMLDivElement>('.hero-floating-content');
    if (!bg && !content) return;

    if (prefersReducedMotion()) return;

    if (bg) {
      gsap.fromTo(
        bg,
        { autoAlpha: 0, scale: 1.04 },
        { autoAlpha: 1, scale: 1, duration: MoraDuration.medium, ease: MoraEase.out, overwrite: 'auto' }
      );
    }

    if (content) {
      const targets = content.querySelectorAll(
        '.hero-badge, .hero-floating-content h1, .hero-floating-content p, .hero-button-stack .btn'
      );
      gsap.fromTo(
        targets,
        { y: 16, autoAlpha: 0 },
        {
          y: 0,
          autoAlpha: 1,
          duration: MoraDuration.base,
          ease: MoraEase.out,
          stagger: 0.07,
          overwrite: 'auto',
        }
      );
    }
  }, [currentSlide]);

  useEffect(() => {
    Promise.all([
      apiFetch<{ data: Service[] }>('/public/services'),
      apiFetch<{ data: Staff[] }>('/public/staff'),
      apiFetch<{ data: CatalogProduct[] }>('/public/products')
    ])
      .then(([servicesRes, staffRes, productsRes]) => {
        setServices(servicesRes.data ?? []);
        setStaff(staffRes.data ?? []);
        setProducts(productsRes.data ?? []);
      })
      .catch(() => {
        setServices([]);
        setStaff([]);
        setProducts([]);
      });
  }, []);

  const getServiceCover = (service: Service): string | undefined => {
    const images = service.images ?? [];
    const cover = images.find((i) => i.isCover) ?? images[0];
    return cover ? resolveUploadUrl(cover.url) : undefined;
  };

  return (
    <div className="public-page page-enter">
      <section className="hero-immersive">
        <img
          key={currentSlide}
          ref={heroBgRef}
          src={heroSlides[currentSlide].image}
          alt="Mora Spa"
          className="hero-bg-media"
        />
        <div className="hero-overlay" />

        <MoraHero
          className="hero-floating-content"
          titleSelector="[data-hero-line]"
          subtitleSelector="[data-hero-subtitle]"
          ctaSelector="[data-hero-cta]"
          floatingSelector="[data-hero-floating]"
        >
          <span
            data-hero-floating
            className="hero-badge hero-badge-accent"
          >
            {heroSlides[currentSlide].badge}
          </span>
          <h1 data-hero-line>{heroSlides[currentSlide].title}</h1>
          <p data-hero-subtitle>{heroSlides[currentSlide].subtitle}</p>
          <div className="hero-button-stack">
            <Link data-hero-cta href="/reservar" className="btn hero-btn-primary shine-on-hover">Reservar ahora</Link>
            <Link data-hero-cta href="/registro" className="btn hero-btn-secondary">Crear cuenta</Link>
          </div>
        </MoraHero>

        <div className="hero-carousel-dots">
          {heroSlides.map((_, index) => (
            <button
              key={index}
              type="button"
              className={`hero-carousel-dot ${currentSlide === index ? 'active' : ''}`}
              onClick={() => setCurrentSlide(index)}
              aria-label={`Slide ${index + 1}`}
            />
          ))}
        </div>
      </section>

      <section className="public-section" id="servicios" style={{ background: 'none', border: 'none', boxShadow: 'none' }}>
        <div className="section-premium-head">
          <div>
            <span className="eyebrow">Favoritos del salon</span>
            <h2>Servicios principales</h2>
          </div>
          <Link href="/reservar" className="section-link-more">Ver agenda</Link>
        </div>

        <MoraScrollReveal selector=".premium-service-box" className="showcase-evolution-grid" stagger={0.08}>
          {services.length === 0 && <div className="list-sub">Todavia no hay servicios publicados.</div>}
          {services.slice(0, 6).map((service) => {
            const cover = getServiceCover(service);
            return (
              <div key={service.id} className="premium-service-box lift-on-hover">
                <div className="service-box-visual">
                  {cover ? (
                    <img src={cover} alt={service.name} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #fde6ef 0%, #f9d9e6 100%)', color: 'var(--accent-dark)', fontWeight: 700, fontSize: '14px' }}>
                      {service.name.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="service-box-overlay">
                    <span className="service-box-tag">{service.durationMin} min</span>
                  </div>
                </div>
                <div className="service-box-content">
                  <div className="service-box-header">
                    <h3>{service.name}</h3>
                    <span className="service-box-price">S/ {service.priceBase}</span>
                  </div>
                  <p className="service-box-text">
                    {service.description ?? 'Atención personalizada con diagnostico y acabado profesional.'}
                  </p>
                  <Link href={`/reservar?service=${service.id}`} className="service-box-action">Reservar este servicio</Link>
                </div>
              </div>
            );
          })}
        </MoraScrollReveal>
      </section>

      <section className="public-section" id="productos">
        <div className="section-premium-head">
          <div>
            <span className="eyebrow">Linea de productos</span>
            <h2>Compra desde la web</h2>
          </div>
          <Link href="/tienda" className="section-link-more">Ir a tienda</Link>
        </div>
        <MoraScrollReveal selector=".shop-feature-card" className="shop-feature-grid" stagger={0.09}>
          {products.filter((product) => product.featured).slice(0, 10).map((product) => {
            const cover = getProductCover(product);
            return (
              <article key={product.id} className="shop-feature-card lift-on-hover">
                <div className="shop-feature-media">
                  {cover ? <img src={resolveUploadUrl(cover.url)} alt={product.name} /> : <div className="empty-state">Sin imagen</div>}
                </div>
                <div className="shop-feature-body">
                  <div className="shop-product-meta">
                    <div>
                      <h3>{product.name}</h3>
                      <div className="list-sub">{product.category ?? 'Linea Mora'}</div>
                    </div>
                    <span className="price-tag">S/ {Number(product.price).toFixed(2)}</span>
                  </div>
                  <p>{product.description ?? 'Compra este favorito desde la tienda online de Mora.'}</p>
                  <Link href="/tienda" className="service-box-action">Comprar ahora</Link>
                </div>
              </article>
            );
          })}
          {products.filter((product) => product.featured).length === 0 && (
            <div className="empty-state">Los productos destacados apareceran aqui cuándo el catalogo este listo.</div>
          )}
        </MoraScrollReveal>
      </section>

      <section className="public-section" id="equipo">
        <div className="section-premium-head">
          <div>
            <span className="eyebrow">Especialistas Mora</span>
            <h2>Equipo especialista</h2>
          </div>
          <Link href="/reservar" className="section-link-more">Agendar con el equipo</Link>
        </div>
        <MoraScrollReveal selector=".staff-card" className="staff-grid" stagger={0.1}>
          {staff.length === 0 && <div className="list-sub">Nuestro equipo aparecera aqui cuándo la agenda este habilitada.</div>}
          {staff.slice(0, 4).map((member, index) => (
            <div key={member.id} className="staff-card lift-on-hover">
              {member.avatarUrl ? (
                <img src={resolveUploadUrl(member.avatarUrl)} alt={member.name} />
              ) : (
                <img src={galleryImages[index % galleryImages.length]} alt={member.name} />
              )}
              <div className="staff-card-body">
                <div className="staff-name">{member.name}</div>
                <div className="staff-role">{member.role ?? 'Especialista'}</div>
                <div className="staff-tags">
                  {member.services?.slice(0, 2).map((item) => (
                    <span key={item.service.name} className="pill">{item.service.name}</span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </MoraScrollReveal>
      </section>

      <section className="loyalty-dark-panel" id="fidelidad">
        <div>
          <span className="eyebrow" style={{ color: 'var(--rose)' }}>Club Mora</span>
          <h2>Reserva, vuelve y mantén tu historial siempre a mano</h2>
          <p>Crea tu cuenta para revisar citas, acceder a promociones web y reservar otra vez en pocos pasos.</p>
          <div className="cta-row">
            <Link href="/reservar" className="btn shine-on-hover pulse-glow">Reservar</Link>
            <Link href="/registro" className="btn btn-outline">Crear cuenta</Link>
          </div>
        </div>
        <MoraScrollReveal selector=".perk-item" className="cta-features" stagger={0.12} variant="fade-up">
          <div className="perk-item">
            <h4>Agenda mas rapido</h4>
            <p>Tu cuenta conserva sesion, historial y reservas para que reagendar sea un proceso corto.</p>
          </div>
          <div className="perk-item">
            <h4>Promos visibles</h4>
            <p>Cuándo activemos nuevas campañas, las veras desde web y podras aplicarlas al reservar.</p>
          </div>
        </MoraScrollReveal>
      </section>
    </div>
  );
}
