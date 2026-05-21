import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const adminPaths = [
  '/dashboard',
  '/agenda',
  '/reservas',
  '/clientes',
  '/usuarios',
  '/equipo',
  '/servicios',
  '/promociones',
  '/productos',
  '/resenas',
  '/albumes'
];

const clientPaths = ['/mi-cuenta', '/reservar'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const staffToken = request.cookies.get('staffToken')?.value;
  const clientToken = request.cookies.get('clientToken')?.value;

  if (adminPaths.some((path) => pathname.startsWith(path))) {
    if (!staffToken) {
      const url = request.nextUrl.clone();
      url.pathname = '/admin/login';
      return NextResponse.redirect(url);
    }
  }

  if (clientPaths.some((path) => pathname.startsWith(path))) {
    if (!clientToken) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/agenda/:path*',
    '/reservas/:path*',
    '/clientes/:path*',
    '/usuarios/:path*',
    '/equipo/:path*',
    '/servicios/:path*',
    '/promociones/:path*',
    '/productos/:path*',
    '/resenas/:path*',
    '/albumes/:path*',
    '/mi-cuenta/:path*',
    '/reservar/:path*'
  ]
};
