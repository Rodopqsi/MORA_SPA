import './globals.css';
import { AuthProvider } from './context/AuthContext';

export const metadata = {
  title: 'Mora Spa',
  description: 'Mora Peluqueria & Spa'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
