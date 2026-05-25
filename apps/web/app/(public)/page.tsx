"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '../lib/api';

type Service = {
  id: number;
  name: string;
  description?: string | null;
  priceBase: string | number;
  durationMin: number;
};
type Promotion = { id: number; name: string; channel?: string | null; startDate: string; endDate: string };
type Staff = { id: number; name: string; role?: string | null; services?: { service: { name: string } }[] };

const heroSlides = [
  {
    badge: 'Mora signature',
    title: 'Color, corte y cuidado en una sola experiencia',
    subtitle: 'Reserva online, elige a tu especialista y llega a tu cita con todo coordinado desde tu cuenta.',
    image: '/assets/img35.webp'
  },
  {
    badge: 'Agenda inteligente',
    title: 'Horarios reales segun servicios, staff y disponibilidad',
    subtitle: 'El sistema cruza duraciones y equipo activo para mostrar solo slots realmente reservables.',
    image: '/assets/img24.jpeg'
  },
  {
    badge: 'Cuidado continuo',
    title: 'Resultados que se ven bien hoy y se mantienen despues',
    subtitle: 'Desde barberia y color hasta nails y tratamientos, cada visita parte de un diagnostico claro.',
    image: '/assets/img18.jpeg'
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

const experienceHighlights = [
  {
    title: 'Diagnostico claro',
    text: 'Cada servicio se recomienda segun necesidad real, tiempo disponible y objetivo de resultado.'
  },
  {
    title: 'Agenda sin fricciones',
    text: 'Tu cuenta conserva reservas, historial y accesos para que reagendar sea rapido y ordenado.'
  },
  {
    title: 'Equipo especializado',
    text: 'Asignamos a cada profesional segun servicio y disponibilidad, no por una agenda ficticia.'
  }
] as const;

export default function PublicHomePage() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [services, setServices] = useState<Service[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev === heroSlides.length - 1 ? 0 : prev + 1));
    }, 6500);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    Promise.all([
      apiFetch<{ data: Service[] }>('/public/services'),
      apiFetch<{ data: Promotion[] }>('/public/promotions'),
      apiFetch<{ data: Staff[] }>('/public/staff')
    ])
      .then(([servicesRes, promotionsRes, staffRes]) => {
        setServices(servicesRes.data ?? []);
        setPromotions(promotionsRes.data ?? []);
        setStaff(staffRes.data ?? []);
      })
      .catch(() => {
        setServices([]);
        setPromotions([]);
        setStaff([]);
      });
  }, []);

  const serviceImages = useMemo(
    () => ['/assets/img10.jpeg', '/assets/img12.jpeg', '/assets/img15.jpeg', '/assets/img31.jpeg'],
    []
  );

  return (
    <div className="public-page reveal">
      <section className="hero-immersive">
        <img src={heroSlides[currentSlide].image} alt="Mora Spa" className="hero-bg-media" />
        <div className="hero-overlay" />

        <div className="hero-floating-content">
          <span className="hero-badge hero-badge-accent">{heroSlides[currentSlide].badge}</span>
          <h1>{heroSlides[currentSlide].title}</h1>
          <p>{heroSlides[currentSlide].subtitle}</p>
          <div className="hero-button-stack">
            <Link href="/reservar" className="btn hero-btn-primary">Reservar ahora</Link>
            <Link href="/registro" className="btn hero-btn-secondary">Crear cuenta</Link>
          </div>
        </div>

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

        <div className="showcase-evolution-grid">
          {services.length === 0 && <div className="list-sub">Todavia no hay servicios publicados.</div>}
          {services.slice(0, 6).map((service, index) => (
            <div key={service.id} className="premium-service-box">
              <div className="service-box-visual">
                <img src={serviceImages[index % serviceImages.length]} alt={service.name} />
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
                  {service.description ?? 'Atencion personalizada con diagnostico y acabado profesional.'}
                </p>
                <Link href="/reservar" className="service-box-action">Reservar este servicio</Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="public-section" id="promos">
        <div className="section-premium-head">
          <div>
            <span className="eyebrow">Campanas activas</span>
            <h2>Promociones vigentes</h2>
          </div>
          <Link href="/reservar" className="section-link-more">Aplicar promo</Link>
        </div>
        <div className="promo-evolution-banner">
          <div>
            <h3>Beneficios listos para tu proxima visita</h3>
            <p>Revisa las promos activas en web y reserva con la combinacion que mejor encaje con tu rutina.</p>
          </div>
          <div className="promo-stack">
            {promotions.length === 0 && <div className="list-sub">No hay promociones activas por ahora.</div>}
            {promotions.slice(0, 3).map((promo) => (
              <div key={promo.id} className="promo-pill">
                <div className="promo-pill-title">{promo.name}</div>
                <div className="promo-pill-sub">
                  Vigente hasta {new Date(promo.endDate).toLocaleDateString('es-PE')}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="public-section" id="equipo">
        <div className="section-premium-head">
          <div>
            <span className="eyebrow">Especialistas Mora</span>
            <h2>Equipo especialista</h2>
          </div>
          <Link href="/reservar" className="section-link-more">Agendar con el equipo</Link>
        </div>
        <div className="staff-grid">
          {staff.length === 0 && <div className="list-sub">Nuestro equipo aparecera aqui cuando la agenda este habilitada.</div>}
          {staff.slice(0, 4).map((member, index) => (
            <div key={member.id} className="staff-card">
              <img src={galleryImages[index % galleryImages.length]} alt={member.name} />
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
        </div>
      </section>

      <section className="public-section" id="galeria">
        <div className="section-premium-head">
          <div>
            <span className="eyebrow">Resultados reales</span>
            <h2>Galeria de resultados</h2>
          </div>
          <Link href="/reservar" className="section-link-more">Quiero este look</Link>
        </div>
        <div className="gallery-grid">
          {galleryImages.map((image) => (
            <div key={image} className="gallery-tile">
              <img src={image} alt="Resultado Mora Spa" />
            </div>
          ))}
        </div>
      </section>

      <section className="public-section">
        <div className="section-premium-head">
          <div>
            <span className="eyebrow">Experiencia Mora</span>
            <h2>Lo que cuidamos en cada visita</h2>
          </div>
          <Link href="/reservar" className="section-link-more">Reservar ahora</Link>
        </div>
        <div className="testimonial-grid">
          {experienceHighlights.map((item) => (
            <div key={item.title} className="testimonial-card">
              <p>{item.text}</p>
              <div className="testimonial-author">{item.title}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="loyalty-dark-panel" id="fidelidad">
        <div>
          <span className="eyebrow" style={{ color: 'var(--rose)' }}>Club Mora</span>
          <h2>Reserva, vuelve y mantén tu historial siempre a mano</h2>
          <p>Crea tu cuenta para revisar citas, acceder a promociones web y reservar otra vez en pocos pasos.</p>
          <div className="cta-row">
            <Link href="/reservar" className="btn">Reservar</Link>
            <Link href="/registro" className="btn btn-outline">Crear cuenta</Link>
          </div>
        </div>
        <div className="cta-features">
          <div className="perk-item">
            <h4>Agenda mas rapido</h4>
            <p>Tu cuenta conserva sesion, historial y reservas para que reagendar sea un proceso corto.</p>
          </div>
          <div className="perk-item">
            <h4>Promos visibles</h4>
            <p>Cuando activemos nuevas campañas, las veras desde web y podras aplicarlas al reservar.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
