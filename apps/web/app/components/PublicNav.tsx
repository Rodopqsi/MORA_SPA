import Link from 'next/link';

export default function PublicNav() {
  return (
    <header className="public-nav">
      <div className="brand">
        <div className="brand-badge">GM</div>
        <div>
          <div className="brand-title">Gisela Mora</div>
          <div className="brand-subtitle">SPA - BARBER</div>
        </div>
      </div>
      <nav className="public-links">
        <Link href="/#servicios">Servicios</Link>
        <Link href="/#promos">Promociones</Link>
        <Link href="/#experiencia">Experiencia</Link>
        <Link href="/login" className="chip">Ingresar</Link>
        <Link href="/registro" className="btn" >Reserva ahora</Link>
      </nav>
    </header>
  );
}