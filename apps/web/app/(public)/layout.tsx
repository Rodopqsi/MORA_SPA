import PublicNav from '../components/PublicNav';

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="public-shell">
      <PublicNav />
      <main className="public-content">{children}</main>
      <footer className="public-footer">
        <div>35 anos de belleza, confianza y estilo.</div>
        <div>Atencion diaria 9-1 y 4-9 - WhatsApp para reservas.</div>
      </footer>
    </div>
  );
}
