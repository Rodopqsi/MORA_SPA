"use client";

import Link from 'next/link';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '../context/AuthContext';

export default function PublicNav() {
  const pathname = usePathname();
  const { isClientAuthed, refresh } = useAuth();

  useEffect(() => {
    refresh();
  }, [pathname, refresh]);

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
        <Link href="/tienda">Productos</Link>
        <Link href="/#promos">Promociones</Link>
        <Link href="/#experiencia">Experiencia</Link>
        {isClientAuthed ? (
          <>
            <Link href="/mi-cuenta" className="chip">Mi cuenta</Link>
            <Link href="/reservar" className="btn">Reservar</Link>
          </>
        ) : (
          <>
            <Link href="/login" className="chip">Ingresar</Link>
            <Link href="/reservar" className="btn">Reserva ahora</Link>
          </>
        )}
      </nav>
    </header>
  );
}