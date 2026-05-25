import Link from 'next/link';
import SideNav from '../components/SideNav';

export const metadata = {
  title: 'Mora Spa Admin',
  description: 'Panel administrativo de Mora Peluqueria & Spa'
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell">
      <SideNav />
      <div className="app-main">
        <header className="topbar">
          <div className="search">
            <span className="search-dot" />
            <input placeholder="Buscar cliente, servicio o cita..." />
          </div>
          <div className="topbar-actions">
            <Link className="chip" href="/agenda">Hoy</Link>
            <Link className="btn btn-outline" href="/agenda">Ver agenda</Link>
            <Link className="btn" href="/reservas">Nueva reserva</Link>
            <div className="user-chip">
              <div className="user-avatar">GM</div>
              <div>
                <div className="user-name">Gisela Mora</div>
                <div className="user-role">Administradora</div>
              </div>
            </div>
          </div>
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
