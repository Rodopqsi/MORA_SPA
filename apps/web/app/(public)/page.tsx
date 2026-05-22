'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

const carouselItems = [
  {
    id: 1,
    badge: 'Descuento Especial',
    title: 'Un espacio de belleza donde cada cita se convierte en ritual',
    subtitle: 'Agenda tus servicios favoritos, descubre promociones activas y vive una atención pensada para ti.',
    image: '/assets/img35.webp',
  },
  {
    id: 2,
    badge: 'Nuevo Servicio',
    title: 'Renueva tu estilo con nuestra Barbería Premium',
    subtitle: 'Cortes clásicos, cuidado de barba ritual y tratamientos faciales exclusivos para caballeros.',
    image: '/assets/img24.jpeg',
  },
  {
    id: 3,
    badge: 'Especialidades',
    title: 'Extensiones en acrílico, gel y técnicas de Nail Art avanzado',
    subtitle: 'Estructuras perfectas, fortalecimiento de uña natural y diseños personalizados creados por expertas.',
    image: '/assets/img18.jpeg',
  }
];

export default function PublicHomePage() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [rulesVisible, setRulesVisible] = useState(false);
  const rulesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Timer del carrusel
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev === carouselItems.length - 1 ? 0 : prev + 1));
    }, 6000);

    // Animación de Scroll con Intersection Observer
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setRulesVisible(true);
        }
      },
      { threshold: 0.15 } // Se activa cuando se ve el 15% de la sección
    );

    if (rulesRef.current) {
      observer.observe(rulesRef.current);
    }

    return () => {
      clearInterval(timer);
      if (rulesRef.current) observer.disconnect();
    };
  }, []);

  return (
    <div className="public-page reveal">
      
      {/* SECCIÓN 1: HERO INMERSIVO */}
      <section className="hero-immersive">
        <img 
          src={carouselItems[currentSlide].image} 
          alt="Mora Spa Hero" 
          className="hero-bg-media"
          key={currentSlide}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[var(--ink)]/90 via-[var(--ink)]/40 to-transparent z-0" />
        
        <div className="hero-floating-content">
          <span className="hero-badge" style={{ background: 'var(--accent)', color: '#fff', border: 'none' }}>
            {carouselItems[currentSlide].badge}
          </span>
          <h1>{carouselItems[currentSlide].title}</h1>
          <p>{carouselItems[currentSlide].subtitle}</p>
          
          <div className="hero-button-stack">
            <Link href="/registro" className="btn hero-btn-primary">
              Crear cuenta
            </Link>
            <Link href="/login" className="btn hero-btn-secondary">
              Ya tengo cuenta
            </Link>
          </div>
        </div>

        <div className="absolute right-10 flex flex-col gap-3 z-10">
          {carouselItems.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentSlide(index)}
              className={`w-1 transition-all duration-500 ${currentSlide === index ? 'h-12 bg-[var(--accent)]' : 'h-6 bg-white/30'}`}
            />
          ))}
        </div>
      </section>

      {/* SECCIÓN 2: REGLAS OPERATIVAS (Luxury Status Bar) */}
      <section 
        id="luxury-status-bar"
        ref={rulesRef} 
        className={`luxury-status-bar ${rulesVisible ? 'animate-in' : ''}`}
      >
        <div className="bar-light-sweep" />

        {/* Bloque 01 */}
        <div className="bar-segment tone-rose">
          <div className="segment-indicator">
            <span className="dot-pulse-rose"></span>
            <span className="segment-number">01</span>
          </div>
          <div className="segment-content">
            <h4>Atención Diaria</h4>
            <p>Lun a Dom • 09-01 PM / 04-09 PM</p>
          </div>
          <span className="segment-badge badge-rose">Feriados Estables</span>
        </div>

        <div className="bar-divider" />

        {/* Bloque 02 */}
        <div className="bar-segment tone-sun">
          <div className="segment-indicator">
            <span className="segment-number">02</span>
          </div>
          <div className="segment-content">
            <h4>Reserva Segura</h4>
            <p>Garantía de turno con adelanto</p>
          </div>
          <div className="segment-badge-group">
            <span className="segment-badge badge-purple">⚡ Yape</span>
            <span className="segment-badge badge-green">💵 Efectivo</span>
          </div>
        </div>

        <div className="bar-divider" />

        {/* Bloque 03 */}
        <div className="bar-segment tone-mint">
          <div className="segment-indicator">
            <span className="segment-number">03</span>
          </div>
          <div className="segment-content">
            <h4>Gestión de Tiempos</h4>
            <p>Puntualidad y autogestión de citas</p>
          </div>
          <span className="segment-badge badge-mint">Tolerancia: 10 min</span>
        </div>
      </section>

      {/* SECCIÓN 3: SERVICIOS */}
      <section id="servicios" className="public-section" style={{ background: 'none', border: 'none', boxShadow: 'none' }}>
        <div className="section-premium-head">
          <div>
            <span className="eyebrow">Nuestra Carta</span>
            <h2>Experiencia Mora</h2>
          </div>
          <Link href="/registro" className="section-link-more">Explorar catálogo →</Link>
        </div>
        
        <div className="showcase-evolution-grid">
          {[
            { title: 'Manicura Artística', tag: 'Top', price: 'S/. 35.00', duration: '45 min', img: '/assets/img35.jpeg' },
            { title: 'Extensiones Acrílicas', tag: 'Tendencia', price: 'S/. 85.00', duration: '120 min', img: '/assets/img18.jpeg' },
            { title: 'Pedicura SPA Profunda', tag: 'Relax', price: 'S/. 45.00', duration: '60 min', img: '/assets/img8.jpeg' },
          ].map((srv, idx) => (
            <div key={idx} className="premium-service-box">
              <div className="service-box-visual">
                <img src={srv.img} alt={srv.title} />
                <div className="service-box-overlay"><span className="service-box-tag">{srv.tag}</span></div>
              </div>
              <div className="service-box-content">
                <div className="flex justify-between items-start">
                  <h3 className="font-semibold text-lg">{srv.title}</h3>
                  <span className="service-box-price text-sm">{srv.price}</span>
                </div>
                <p className="text-xs text-[var(--muted)]">Duración: {srv.duration}</p>
                <Link href="/registro" className="service-box-action">Agendar este servicio</Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* SECCIÓN 4: PRODUCTOS */}
      <section id="productos" style={{ padding: '0 32px' }}>
        <div className="section-premium-head">
          <div>
            <span className="eyebrow">Cuidado en Casa</span>
            <h2>Línea de Productos</h2>
          </div>
          <p className="text-xs text-[var(--muted)]">Consulta disponibilidad en el local</p>
        </div>
        <div className="grid grid-3 gap-6">
          {['Aceites Hidratantes', 'Cremas Exfoliantes', 'Bases Fortalecedoras'].map((prod, i) => (
            <div key={i} className="card bg-white border border-[var(--border)] p-4 rounded-2xl hover:shadow-md transition-all">
              <div className="h-32 bg-[var(--bg)] rounded-xl mb-3 flex items-center justify-center font-serif text-[var(--accent-dark)]">Product Visual</div>
              <h4 className="font-semibold text-sm">{prod}</h4>
              <p className="text-xs text-[var(--muted)] mt-1">Calidad profesional para prolongar tus resultados.</p>
            </div>
          ))}
        </div>
      </section>

      {/* SECCIÓN 5: FIDELIZACIÓN */}
      <section id="fidelidad" style={{ padding: '0 32px 60px' }}>
        <div className="loyalty-dark-panel">
          <div className="flex flex-col gap-6">
            <span className="eyebrow" style={{ color: 'var(--rose)' }}>Lealtad Mora</span>
            <h2 className="text-4xl font-serif leading-tight">Reconocemos tu confianza</h2>
            <p className="text-white/70 leading-relaxed">
              En Mora Peluquería & Spa, premiamos que nos elijas. Nuestro sistema rastrea automáticamente tus logros y fechas especiales.
            </p>
            <div className="flex gap-4">
              <Link href="/registro" className="btn">Unirse al Club</Link>
            </div>
          </div>
          
          <div className="flex flex-col gap-4">
            <div className="perk-item">
              <h4 className="text-[var(--sun)] font-semibold mb-1">Regalo de Cumpleaños</h4>
              <p className="text-xs text-white/60">Recibe una atención de cortesía o un descuento especial en tu mes festivo al estar registrada.</p>
            </div>
            <div className="perk-item">
              <h4 className="text-[var(--mint)] font-semibold mb-1">Programa de Referidos</h4>
              <p className="text-xs text-white/60">Por cada amiga que traigas al salón y complete su primera reserva, obtienes un bono directo en tu cuenta.</p>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}