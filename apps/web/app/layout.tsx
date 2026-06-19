import './globals.css';
import { AuthProvider } from './context/AuthContext';
import ChatBot from './components/ChatBot';

export const metadata = {
  title: 'Mora Spa',
  description: 'Mora Peluquería & Spa'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <AuthProvider>
          {children}
          <ChatBot />
        </AuthProvider>
      </body>
    </html>
  );
}
