'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const sections = [
  {
    title: 'Operación',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: 'DB' },
      { href: '/agenda', label: 'Agenda', icon: 'AG' },
      { href: '/reservas', label: 'Reservas', icon: 'RS' }
    ]
  },
  {
    title: 'Gestión',
    items: [
      { href: '/usuarios', label: 'Usuarios', icon: 'US' },
      { href: '/equipo', label: 'Equipo', icon: 'EQ' },
      { href: '/servicios', label: 'Servicios', icon: 'SV' },
      { href: '/promociones', label: 'Promociones', icon: 'PR' },
      { href: '/productos', label: 'Productos', icon: 'PD' }
    ]
  },
  {
    title: 'Galería',
    items: [
      { href: '/albumes', label: 'Galería', icon: 'GL' }
    ]
  },
  {
    title: 'Sistema',
    items: [
      { href: '/configuracion', label: 'Configuración', icon: 'CF' }
    ]
  }
];

const isActive = (pathname: string, href: string) => {
  if (href === '/dashboard' && pathname === '/') return true;
  return pathname === href || pathname.startsWith(`${href}/`);
};

export default function SideNav() {
  const pathname = usePathname();

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-badge"><img src="/assets/logo.svg" alt="GM" /></div>
        <div>
          <div className="brand-title">Gisela Mora</div>
          <div className="brand-subtitle">SPA - BARBER</div>
        </div>
      </div>

      <nav className="nav">
        {sections.map((section) => (
          <div key={section.title} className="nav-section">
            <div className="nav-title">{section.title}</div>
            <div className="nav-items">
              {section.items.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`nav-item ${active ? 'active' : ''}`}
                  >
                    <span className="nav-icon">{item.icon}</span>
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="sidebar-card">
        <div className="sidebar-card-title">35 años floreciendo belleza</div>
        <div className="sidebar-card-text">Atendemos todos los dias: 9-1 y 4-9</div>
      </div>
    </aside>
  );
}