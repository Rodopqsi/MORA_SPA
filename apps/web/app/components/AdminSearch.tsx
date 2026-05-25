'use client';

import { FormEvent, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

export default function AdminSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (pathname === '/busqueda') {
      setQuery(new URLSearchParams(window.location.search).get('q') ?? '');
      return;
    }

    setQuery('');
  }, [pathname]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextQuery = query.trim();

    if (!nextQuery) {
      router.push('/busqueda');
      return;
    }

    router.push(`/busqueda?q=${encodeURIComponent(nextQuery)}`);
  };

  return (
    <form className="search" onSubmit={handleSubmit} role="search">
      <span className="search-dot" />
      <input
        placeholder="Buscar cliente, servicio o cita..."
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
    </form>
  );
}