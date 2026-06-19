import Link from 'next/link';
import PublicNav from '../components/PublicNav';

const footerColumns = [
  {
    title: 'Atención',
    lines: [
      'Reserva online, seguimiento desde tu cuenta y confirmacion personalizada.',
      'Servicios, productos y promos en un solo flujo pensado para volver fácil.'
    ]
  },
  {
    title: 'Horarios',
    lines: [
      'Lunes a sabado: 9:00 am a 1:00 pm',
      'Tardes: 4:00 pm a 9:00 pm',
      'Domingos: 10:00 am a 2:00 pm'
    ]
  },
  {
    title: 'Contacto',
    lines: [
      'Gestiona reservas y seguimiento desde la agenda web de Mora.',
      'Tu cuenta centraliza historial, promociones y movimientos.'
    ]
  }
] as const;

const footerLinks = [
  { href: '/#servicios', label: 'Servicios' },
  { href: '/tienda', label: 'Productos' },
  { href: '/reservar', label: 'Reservar' },
  { href: '/mi-cuenta', label: 'Mi cuenta' },
  { href: '/#promos', label: 'Promociones' },
  { href: '/#equipo', label: 'Equipo' }
] as const;

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="public-shell">
      <PublicNav />
      <main className="public-content">{children}</main>
      <footer className="public-footer">
        <div className="public-footer-top">
          <div className="public-footer-brand-block">
            <div className="public-footer-brand-mark">
              <div className="brand-badge public-footer-brand-badge">GM</div>
              <div>
                <div className="public-footer-brand-title">Gisela Mora</div>
                <div className="public-footer-brand-subtitle">SPA &middot; BARBER</div>
              </div>
            </div>
            <p>
              Especialistas en color, barberia, nails y reservas digitales con disponibilidad real y seguimiento claro.
            </p>
          </div>

          <div className="public-footer-columns">
            {footerColumns.map((column) => (
              <div key={column.title} className="public-footer-column">
                <h3>{column.title}</h3>
                {column.lines.map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
            ))}
          </div>

          <div className="public-footer-social" aria-label="Presencia social Mora">
            <a href="#" className="public-footer-social-link" aria-label="Instagram">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="5" />
                <circle cx="12" cy="12" r="4" />
                <circle cx="17.4" cy="6.6" r="1" fill="currentColor" stroke="none" />
              </svg>
            </a>
            <a href="#" className="public-footer-social-link" aria-label="Facebook">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M13.5 21v-7h2.4l.4-3h-2.8V9.1c0-.9.2-1.6 1.5-1.6H16V4.8c-.3 0-1.2-.1-2.2-.1-2.2 0-3.7 1.3-3.7 3.9V11H8v3h2.1v7h3.4Z" />
              </svg>
            </a>
            <a href="#" className="public-footer-social-link" aria-label="TikTok">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M16.6 5.8a4.7 4.7 0 0 1-3.1-1.4v9.2a4.6 4.6 0 1 1-4.6-4.6c.4 0 .8.1 1.2.2v2.5a2.3 2.3 0 1 0 1.1 1.9V3.8h2.4c.2 1 .8 1.9 1.6 2.5.8.6 1.8 1 2.8 1.1v2.4c-.5 0-.9-.1-1.4-.2Z" />
              </svg>
            </a>
          </div>
        </div>

        <div className="public-footer-bottom">
          <div className="public-footer-powered">
            <span>Mora Peluquería &amp; Spa &middot; Agenda, tienda y seguimiento</span>
          </div>

          <nav className="public-footer-links" aria-label="Enlaces del sitio">
            {footerLinks.map((link) => (
              <Link key={link.href} href={link.href}>
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </footer>
    </div>
  );
}
