import { PromotionType } from '@prisma/client';
import { prisma } from './core';

export interface ChatCard {
  type: 'service' | 'product' | 'promotion';
  id: number;
  title: string;
  subtitle?: string;
  description?: string;
  imageUrl?: string;
  price?: string;
  badge?: string;
  link?: string;
  actionLabel?: string;
}

export interface ChatResponseData {
  reply: string;
  suggestions: string[];
  cards?: ChatCard[];
}

interface ChatContext {
  services: { id: number; name: string; description: string | null; durationMin: number; priceBase: unknown; images: { url: string }[] }[];
  products: { id: number; name: string; description: string | null; price: unknown; category: string | null; stock: number; featured: boolean; images: { url: string }[] }[];
  promotions: { id: number; name: string; type: PromotionType; value: unknown | null; startDate: Date; endDate: Date }[];
  staff: { id: number; name: string; role: string | null; services: { service: { name: string } }[] }[];
  reviews: { rating: number; comment: string | null; reservation: { client: { name: string } } | null }[];
}

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '');
}

function tokenize(text: string): string[] {
  return normalizeText(text)
    .split(/\s+/)
    .filter((w) => w.length > 1);
}

function scoreMatch(text: string, tokens: string[]): number {
  const haystack = normalizeText(text);
  return tokens.reduce((score, token) => {
    if (haystack.includes(token)) return score + 1;
    if (token.length >= 3 && haystack.split(/\s+/).some((w) => w.startsWith(token.slice(0, 3)))) return score + 0.5;
    return score;
  }, 0);
}

function decimalToString(value: unknown): string {
  return Number(value).toFixed(2);
}

function resolveImageUrl(url?: string): string | undefined {
  if (!url) return undefined;
  return url;
}

export async function buildChatContext(): Promise<ChatContext> {
  const [services, products, promotions, staff, reviews] = await Promise.all([
    prisma.service.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
      include: { images: { orderBy: { isCover: 'desc' }, take: 1 } }
    }),
    prisma.product.findMany({
      where: { active: true },
      orderBy: [{ featured: 'desc' }, { name: 'asc' }],
      include: { images: { orderBy: { isCover: 'desc' }, take: 1 } }
    }),
    prisma.promotion.findMany({
      where: { active: true, startDate: { lte: new Date() }, endDate: { gte: new Date() } },
      orderBy: { startDate: 'desc' }
    }),
    prisma.staff.findMany({
      where: { active: true },
      include: { services: { include: { service: { select: { name: true } } } } },
      orderBy: { name: 'asc' }
    }),
    prisma.review.findMany({
      where: { status: 'APROBADA', visible: true },
      include: { reservation: { include: { client: { select: { name: true } } } } },
      orderBy: { createdAt: 'desc' },
      take: 20
    })
  ]);
  return { services, products, promotions, staff, reviews };
}

export function handleChatbotQuery(message: string, ctx: ChatContext): ChatResponseData {
  const tokens = tokenize(message);

  const greetings = ['hola', 'buenas', 'buen dia', 'buenas tardes', 'buenas noches', 'que tal', 'como estas', 'mora'];
  if (tokens.some((t) => greetings.some((g) => t.includes(g)))) {
    const topServices = ctx.services.slice(0, 3).map((s) => ({
      type: 'service' as const,
      id: s.id,
      title: s.name,
      subtitle: `${s.durationMin} min`,
      description: s.description ?? undefined,
      imageUrl: resolveImageUrl(s.images[0]?.url),
      price: `S/ ${decimalToString(s.priceBase)}`,
      link: `/reservar?service=${s.id}`,
      actionLabel: 'Reservar'
    }));
    return {
      reply: `¡Hola! Soy el asistente virtual de Mora Spa 💋. ¿En qué puedo ayudarte hoy?`,
      suggestions: ['Ver servicios', 'Ver productos', 'Promociones', 'Recomendarme algo'],
      cards: topServices
    };
  }

  const goodbyes = ['adios', 'chau', 'gracias', 'hasta luego', 'bye'];
  if (tokens.some((t) => goodbyes.some((g) => t.includes(g)))) {
    return { reply: '¡Con gusto! 💖 Si necesitas algo más, aquí estaré. ¡Que tengas un hermoso día!', suggestions: ['Hola de nuevo'] };
  }

  const serviceKeywords = ['servicio', 'servicios', 'tratamiento', 'tratamientos', 'corte', 'color', 'barberia', 'manicure', 'pedicure', 'facial', 'masaje', 'spa'];
  const wantsServices = tokens.some((t) => serviceKeywords.some((k) => t.includes(k)));

  if (wantsServices) {
    const matched = ctx.services
      .map((s) => ({ ...s, score: scoreMatch(s.name + ' ' + (s.description ?? ''), tokens) }))
      .filter((s) => s.score > 0 || tokens.length === 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    const source = matched.length > 0 ? matched : ctx.services.slice(0, 5);
    const cards: ChatCard[] = source.map((s) => ({
      type: 'service',
      id: s.id,
      title: s.name,
      subtitle: `${s.durationMin} min`,
      description: s.description ?? undefined,
      imageUrl: resolveImageUrl(s.images[0]?.url),
      price: `S/ ${decimalToString(s.priceBase)}`,
      link: `/reservar?service=${s.id}`,
      actionLabel: 'Reservar'
    }));

    if (matched.length === 1) {
      return {
        reply: `**💅 ${matched[0].name}**\n\n💰 Precio: S/ ${decimalToString(matched[0].priceBase)}\n⏱️ Duración: ${matched[0].durationMin} minutos\n📝 ${matched[0].description ?? 'Un servicio de calidad en Mora Spa.'}`,
        suggestions: ['Reservar cita', 'Ver más servicios', 'Ver productos relacionados'],
        cards
      };
    }

    return {
      reply: matched.length > 0
        ? `Estos son los servicios que podrían interesarte:`
        : `Nuestros servicios principales:`,
      suggestions: source.slice(0, 3).map((s) => s.name),
      cards
    };
  }

  const productKeywords = ['producto', 'productos', 'tienda', 'boutique', 'shampoo', 'aceite', 'crema', 'comprar', 'catalogo'];
  const wantsProducts = tokens.some((t) => productKeywords.some((k) => t.includes(k)));

  if (wantsProducts) {
    const matched = ctx.products
      .map((p) => ({ ...p, score: scoreMatch(p.name + ' ' + (p.description ?? '') + ' ' + (p.category ?? ''), tokens) }))
      .filter((p) => p.score > 0 || tokens.length === 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    const cards: ChatCard[] = matched.map((p) => ({
      type: 'product',
      id: p.id,
      title: p.name,
      subtitle: p.category ?? undefined,
      description: p.description ?? undefined,
      imageUrl: resolveImageUrl(p.images[0]?.url),
      price: `S/ ${decimalToString(p.price)}`,
      badge: p.featured ? 'Destacado' : undefined,
      link: '/tienda',
      actionLabel: 'Ver en tienda'
    }));

    return {
      reply: matched.length > 0 ? `Productos encontrados:` : `Nuestros productos destacados ⭐:`,
      suggestions: matched.slice(0, 3).map((p) => p.name),
      cards
    };
  }

  const priceKeywords = ['precio', 'cuanto', 'cuanto cuesta', 'valor', 'tarifa'];
  const wantsPrice = tokens.some((t) => priceKeywords.some((k) => t.includes(k)));

  if (wantsPrice) {
    const serviceMatch = ctx.services
      .map((s) => ({ ...s, score: scoreMatch(s.name + ' ' + (s.description ?? ''), tokens) }))
      .sort((a, b) => b.score - a.score)
      .filter((s) => s.score > 0)
      .slice(0, 3);

    if (serviceMatch.length > 0) {
      const cards: ChatCard[] = serviceMatch.map((s) => ({
        type: 'service',
        id: s.id,
        title: s.name,
        subtitle: `${s.durationMin} min`,
        price: `S/ ${decimalToString(s.priceBase)}`,
        imageUrl: resolveImageUrl(s.images[0]?.url),
        link: `/reservar?service=${s.id}`,
        actionLabel: 'Reservar'
      }));
      return { reply: `Aquí tienes los precios:`, suggestions: serviceMatch.map((s) => 'Reservar ' + s.name), cards };
    }

    const productMatch = ctx.products
      .map((p) => ({ ...p, score: scoreMatch(p.name + ' ' + (p.description ?? ''), tokens) }))
      .sort((a, b) => b.score - a.score)
      .filter((p) => p.score > 0)
      .slice(0, 3);

    if (productMatch.length > 0) {
      const cards: ChatCard[] = productMatch.map((p) => ({
        type: 'product',
        id: p.id,
        title: p.name,
        price: `S/ ${decimalToString(p.price)}`,
        imageUrl: resolveImageUrl(p.images[0]?.url),
        link: '/tienda',
        actionLabel: 'Ver en tienda'
      }));
      return { reply: `Precios encontrados:`, suggestions: productMatch.map((p) => p.name), cards };
    }

    return {
      reply: `Nuestros servicios van desde **S/ ${decimalToString(ctx.services.reduce((min, s) => (s.priceBase < min ? s.priceBase : min), ctx.services[0]?.priceBase ?? 0))}** hasta **S/ ${decimalToString(ctx.services.reduce((max, s) => (s.priceBase > max ? s.priceBase : max), ctx.services[0]?.priceBase ?? 0))}**.`,
      suggestions: ['Ver servicios', 'Ver productos']
    };
  }

  const promoKeywords = ['promocion', 'promociones', 'descuento', 'oferta', 'rebaja', 'combo'];
  const wantsPromos = tokens.some((t) => promoKeywords.some((k) => t.includes(k)));

  if (wantsPromos) {
    if (ctx.promotions.length === 0) {
      return { reply: 'Por ahora no tenemos promociones activas, pero siempre hay sorpresas 💫.', suggestions: ['Ver servicios', 'Ver productos'] };
    }
    const cards: ChatCard[] = ctx.promotions.slice(0, 3).map((p) => ({
      type: 'promotion',
      id: p.id,
      title: p.name,
      subtitle: p.value ? (p.type === 'PORCENTAJE' ? `${Number(p.value)}% OFF` : `S/ ${decimalToString(p.value)} OFF`) : undefined,
      description: `Vigente hasta ${p.endDate.toLocaleDateString('es-PE')}`,
      badge: 'Promoción',
      link: `/reservar`,
      actionLabel: 'Aprovechar'
    }));
    return { reply: `🎉 Promociones activas:`, suggestions: ['Reservar cita', 'Ver servicios'], cards };
  }

  const staffKeywords = ['equipo', 'staff', 'especialista', 'profesional', 'quien', 'barbero', 'estilista', 'colorista'];
  const wantsStaff = tokens.some((t) => staffKeywords.some((k) => t.includes(k)));

  if (wantsStaff) {
    const matchedStaff = ctx.staff
      .map((s) => ({ ...s, score: scoreMatch(s.name + ' ' + (s.role ?? ''), tokens) }))
      .filter((s) => s.score > 0 || tokens.length === 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    const list = matchedStaff.map((s) => {
      const services = s.services.map((ss) => ss.service.name).join(', ');
      return `• **${s.name}** ${s.role ? `— ${s.role}` : ''}\n  Servicios: ${services || 'Varios servicios'}`;
    }).join('\n\n');

    return {
      reply: `Nuestro equipo:\n\n${list}\n\n¿Te gustaría reservar con alguno de ellos?`,
      suggestions: matchedStaff.slice(0, 3).map((s) => 'Reservar con ' + s.name)
    };
  }

  const recKeywords = ['recomienda', 'recomiendame', 'sugiere', 'sugerencia', 'que me recomiendas', 'mejor', 'ideal', 'perfecto'];
  const wantsRecommendation = tokens.some((t) => recKeywords.some((k) => t.includes(k)));

  if (wantsRecommendation) {
    const hairKeywords = ['cabello', 'pelo', 'corte', 'color', 'tinte', 'mechas', 'balayage', 'decoloracion'];
    const nailKeywords = ['uña', 'unas', 'manicure', 'pedicure', 'gel', 'acrilico'];
    const skinKeywords = ['piel', 'facial', 'limpieza', 'hidratacion', 'antiage'];
    const wantsHair = tokens.some((t) => hairKeywords.some((k) => t.includes(k)));
    const wantsNails = tokens.some((t) => nailKeywords.some((k) => t.includes(k)));
    const wantsSkin = tokens.some((t) => skinKeywords.some((k) => t.includes(k)));

    let recs = [];
    if (wantsHair) recs = ctx.services.filter((s) => hairKeywords.some((k) => normalizeText(s.name + ' ' + (s.description ?? '')).includes(k))).slice(0, 3);
    else if (wantsNails) recs = ctx.services.filter((s) => nailKeywords.some((k) => normalizeText(s.name + ' ' + (s.description ?? '')).includes(k))).slice(0, 3);
    else if (wantsSkin) recs = ctx.services.filter((s) => skinKeywords.some((k) => normalizeText(s.name + ' ' + (s.description ?? '')).includes(k))).slice(0, 3);
    else recs = [...ctx.services].sort(() => 0.5 - Math.random()).slice(0, 3);

    const cards: ChatCard[] = recs.map((s) => ({
      type: 'service',
      id: s.id,
      title: s.name,
      subtitle: `${s.durationMin} min`,
      description: s.description ?? undefined,
      imageUrl: resolveImageUrl(s.images[0]?.url),
      price: `S/ ${decimalToString(s.priceBase)}`,
      link: `/reservar?service=${s.id}`,
      actionLabel: 'Reservar'
    }));

    return {
      reply: `Basándome en lo que buscas, te recomiendo:`,
      suggestions: recs.map((s) => 'Reservar ' + s.name),
      cards
    };
  }

  const reviewKeywords = ['resena', 'resenas', 'opinion', 'opiniones', 'popular', 'recomendado', 'estrellas', 'calificacion'];
  const wantsReviews = tokens.some((t) => reviewKeywords.some((k) => t.includes(k)));

  if (wantsReviews) {
    const avgRating = ctx.reviews.length > 0 ? (ctx.reviews.reduce((sum, r) => sum + r.rating, 0) / ctx.reviews.length).toFixed(1) : '5.0';
    const recent = ctx.reviews.slice(0, 3).map((r) => `\u201c${r.comment ?? 'Excelente servicio'}\u201d \u2014 ${r.reservation?.client?.name ?? 'Cliente'} (${r.rating}\u2b50)`).join('\n');
    return { reply: `🌟 Nuestros clientes nos califican con **${avgRating}/5 estrellas**\n\nÚltimas opiniones:\n${recent}`, suggestions: ['Reservar cita', 'Ver servicios'] };
  }

  const bookingKeywords = ['reserva', 'reservar', 'cita', 'agenda', 'horario', 'disponible', 'turno'];
  const wantsBooking = tokens.some((t) => bookingKeywords.some((k) => t.includes(k)));

  if (wantsBooking) {
    return { reply: '📅 Puedes reservar tu cita directamente desde nuestra web. ¿Te gustaría que te muestre los servicios disponibles?', suggestions: ['Reservar cita', 'Ver servicios', 'Ver equipo'] };
  }

  const contactKeywords = ['donde', 'ubicacion', 'direccion', 'telefono', 'whatsapp', 'contacto', 'llegar'];
  const wantsContact = tokens.some((t) => contactKeywords.some((k) => t.includes(k)));

  if (wantsContact) {
    return { reply: '📍 Puedes encontrarnos en nuestras redes y reservar directamente desde la web.', suggestions: ['Reservar cita', 'Ver servicios', 'Ver productos'] };
  }

  return {
    reply: `¡Entiendo! 💖 Puedo ayudarte con:\n• Servicios y precios\n• Productos de nuestra boutique\n• Promociones activas\n• Recomendaciones personalizadas\n• Reservas\n\n¿Qué te gustaría saber?`,
    suggestions: ['Ver servicios', 'Ver productos', 'Recomendarme algo', 'Promociones']
  };
}
