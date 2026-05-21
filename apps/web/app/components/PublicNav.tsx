"use client";

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { getToken } from '../lib/auth';

export default function PublicNav() {
  const pathname = usePathname();
  const [isAuthed, setIsAuthed] = useState(false);

  useEffect(() => {
    setIsAuthed(Boolean(getToken()));
  }, [pathname]);

  return (
    <header className="public-nav">
      <div className="!flex !flex-row !items-center gap-3 mb-8">
  <div className="brand-badge flex-shrink-0">GM</div>
  <div className="flex flex-col justify-center text-left">
    <div className="brand-title leading-tight font-bold">Gisela Mora</div>
    <div className="brand-subtitle text-xs leading-none">SPA - BARBER</div>
  </div>
</div>
      <nav className="public-links">
        <Link href="/#servicios">Servicios</Link>
        <Link href="/#promos">Promociones</Link>
        <Link href="/#experiencia">Experiencia</Link>
        {isAuthed ? (
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
