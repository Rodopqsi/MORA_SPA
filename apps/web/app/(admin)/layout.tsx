import Link from 'next/link';
import SideNav from '../components/SideNav';
import AdminSearch from '../components/AdminSearch';
import AdminLogoutButton from '../components/AdminLogoutButton';
import AdminUserChip from '../components/AdminUserChip';
import CloudinaryBanner from '../components/CloudinaryBanner';

export const metadata = {
  title: 'Mora Spa Admin',
  description: 'Panel administrativo de Mora Peluquería & Spa'
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell">
      <SideNav />
      <div className="app-main">
        <header className="topbar">
          <AdminSearch />
          <div className="topbar-actions">
            <Link className="chip" href="/agenda">Hoy</Link>
            <Link className="btn btn-outline" href="/agenda">Ver agenda</Link>
            <Link className="btn" href="/reservas">Nueva reserva</Link>
            <AdminLogoutButton />
            <AdminUserChip />
          </div>
        </header>
        <CloudinaryBanner />
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
