import { redirect } from 'next/navigation';

export default function ReservarIndexPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const sp = new URLSearchParams();
  Object.entries(searchParams).forEach(([key, value]) => {
    if (typeof value === 'string') sp.set(key, value);
    else if (Array.isArray(value)) value.forEach((v) => sp.append(key, v));
  });
  const qs = sp.toString();
  redirect(`/reservar/paso-1${qs ? `?${qs}` : ''}`);
}
