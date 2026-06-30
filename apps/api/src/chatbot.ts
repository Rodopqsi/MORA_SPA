import { PromotionType } from '@prisma/client';
import { prisma } from './core';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let genAI: any = null;

const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? '';

async function initGenAI() {
  if (!GEMINI_API_KEY) return;
  if (!genAI) {
    const mod = await import('@google/genai');
    genAI = new mod.GoogleGenAI({ apiKey: GEMINI_API_KEY });
  }
}

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

const API_BASE_URL = process.env.API_PUBLIC_URL || 'http://localhost:4000';

function resolveImageUrl(url?: string): string | undefined {
  if (!url) return undefined;
  if (url.startsWith('http')) return url;
  return `${API_BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
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

function buildSystemPrompt(ctx: ChatContext): string {
  const servicesText = ctx.services.map(s =>
    `- ${s.name}: S/ ${decimalToString(s.priceBase)}, ${s.durationMin} min. ${s.description ?? ''}`
  ).join('\n');

  const productsText = ctx.products.map(p =>
    `- ${p.name}: S/ ${decimalToString(p.price)}, categoría ${p.category ?? 'general'}. Stock: ${p.stock}. ${p.description ?? ''}`
  ).join('\n');

  const promosText = ctx.promotions.map(p =>
    `- ${p.name}: ${p.type === 'PORCENTAJE' ? `${Number(p.value)}% OFF` : `S/ ${decimalToString(p.value)} OFF`}. Vigente hasta ${p.endDate.toLocaleDateString('es-PE')}.`
  ).join('\n') || 'Sin promociones activas.';

  const staffText = ctx.staff.map(s =>
    `- ${s.name}${s.role ? ` (${s.role})` : ''}: especialista en ${s.services.map(ss => ss.service.name).join(', ') || 'varios servicios'}.`
  ).join('\n');

  const avgRating = ctx.reviews.length > 0 ? (ctx.reviews.reduce((sum, r) => sum + r.rating, 0) / ctx.reviews.length).toFixed(1) : '5.0';

  return `Eres "Mora Assistant", el asistente virtual de Gisela Mora SPA-BARBER. Eres amable, profesional, usas emojis con moderación y conoces a fondo el negocio.

REGLAS IMPORTANTES:
- Solo hablas sobre servicios, productos, promociones, reservas y recomendaciones relacionadas con el spa/barbería.
- Si el usuario pregunta algo fuera de tema (política, noticias, matemáticas, etc.), responde amablemente que solo puedes ayudar con temas de Mora Spa.
- Puedes dar recomendaciones de color de cabello, tratamientos faciales, etc., basándote en el contexto del negocio y el conocimiento general de estética/belleza.
- Cuando recomiendes servicios o productos, sé específico y menciona precios si aplica.
- Si el usuario quiere reservar, indícale que puede hacerlo desde la web.
- El negocio está en Perú, los precios son en soles (S/). Atienden de lunes a sábado.
- Calificación promedio de clientes: ${avgRating}/5 estrellas.

SERVICIOS DISPONIBLES:
${servicesText}

PRODUCTOS EN TIENDA:
${productsText}

PROMOCIONES ACTIVAS:
${promosText}

EQUIPO:
${staffText}

Responde en español, de forma breve pero útil. Si puedes, sugiere 1-3 opciones de seguimiento al final.`;
}

function extractSuggestions(text: string): string[] {
  const suggestions: string[] = [];
  const lines = text.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('•') || trimmed.startsWith('-') || trimmed.startsWith('*')) {
      const content = trimmed.slice(1).trim();
      if (content.length > 3 && content.length < 60) {
        suggestions.push(content);
      }
    }
  }
  if (suggestions.length === 0) {
    const fallback = ['Ver servicios', 'Ver productos', 'Reservar cita'];
    return fallback;
  }
  return suggestions.slice(0, 4);
}

async function callGemini(message: string, ctx: ChatContext): Promise<string> {
  await initGenAI();
  if (!genAI) {
    console.warn('[Chatbot] Gemini no inicializado (sin API key). Usando fallback.');
    return fallbackReply(message, ctx);
  }

  const systemPrompt = buildSystemPrompt(ctx);

  try {
    const response = await genAI.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [
        { role: 'user', parts: [{ text: systemPrompt }] },
        { role: 'model', parts: [{ text: 'Entendido. Estoy listo para ayudar a los clientes de Mora Spa.' }] },
        { role: 'user', parts: [{ text: message }] }
      ],
      config: {
        temperature: 0.7,
        maxOutputTokens: 800,
      }
    });

    const text = response?.text;
    if (!text) {
      console.warn('[Chatbot] Gemini respondió vacío. Usando fallback.');
      return fallbackReply(message, ctx);
    }
    return text;
  } catch (err: any) {
    console.error('[Chatbot] Gemini error:', err?.message || err);
    return fallbackReply(message, ctx);
  }
}

export async function handleChatbotQuery(message: string, ctx: ChatContext): Promise<ChatResponseData> {
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

  const bookingKeywords = ['reserva', 'reservar', 'cita', 'agenda', 'horario', 'disponible', 'turno'];
  const wantsBooking = tokens.some((t) => bookingKeywords.some((k) => t.includes(k)));

  const geminiReply = await callGemini(message, ctx);
  const suggestions = extractSuggestions(geminiReply);

  if (wantsBooking && !suggestions.some(s => s.toLowerCase().includes('reservar'))) {
    suggestions.unshift('Reservar cita');
  }

  const cards: ChatCard[] = [];

  for (const service of ctx.services) {
    const serviceName = normalizeText(service.name);
    if (normalizeText(geminiReply).includes(serviceName) && cards.length < 3) {
      cards.push({
        type: 'service',
        id: service.id,
        title: service.name,
        subtitle: `${service.durationMin} min`,
        description: service.description ?? undefined,
        imageUrl: resolveImageUrl(service.images[0]?.url),
        price: `S/ ${decimalToString(service.priceBase)}`,
        link: `/reservar?service=${service.id}`,
        actionLabel: 'Reservar'
      });
    }
  }

  for (const product of ctx.products) {
    const productName = normalizeText(product.name);
    if (normalizeText(geminiReply).includes(productName) && cards.length < 3) {
      cards.push({
        type: 'product',
        id: product.id,
        title: product.name,
        subtitle: product.category ?? undefined,
        description: product.description ?? undefined,
        imageUrl: resolveImageUrl(product.images[0]?.url),
        price: `S/ ${decimalToString(product.price)}`,
        link: '/tienda',
        actionLabel: 'Ver en tienda'
      });
    }
  }

  return {
    reply: geminiReply,
    suggestions: suggestions.slice(0, 4),
    cards: cards.length > 0 ? cards : undefined
  };
}

function fallbackReply(message: string, ctx: ChatContext): string {
  const tokens = tokenize(message);

  // 1. Preguntas de precio / costo — buscar servicios o productos por relevancia
  const priceKeywords = ['precio', 'cuesta', 'cuanto', 'valor', 'tarifa'];
  const wantsPrice = tokens.some((t) => priceKeywords.includes(t));
  if (wantsPrice) {
    const stopwords = new Set(['de', 'un', 'una', 'el', 'la', 'los', 'las', 'con', 'para', 'y', 'o', 'en', 'por', 'cuanto', 'cuesta', 'precio', 'valor', 'que', 'es', 'son', 'me']);
    const meaningfulTokens = tokens.filter((t) => !stopwords.has(t) && t.length >= 3);
    const searchTokens = meaningfulTokens.length > 0 ? meaningfulTokens : tokens.filter((t) => t.length >= 3);

    let bestService = null;
    let bestScore = 0;
    for (const service of ctx.services) {
      const nameScore = scoreMatch(service.name, searchTokens) * 2; // nombre pesa más
      const descScore = scoreMatch(service.description || '', searchTokens);
      const score = nameScore + descScore;
      if (score > bestScore) {
        bestScore = score;
        bestService = service;
      }
    }
    if (bestService && bestScore >= 0.5) {
      return `${bestService.name}: S/ ${decimalToString(bestService.priceBase)} — ${bestService.durationMin} min. ${bestService.description ?? ''} ¿Te gustaría reservar? 💅`;
    }

    let bestProduct = null;
    let bestProductScore = 0;
    for (const product of ctx.products) {
      const nameScore = scoreMatch(product.name, searchTokens) * 2;
      const descScore = scoreMatch(product.description || '', searchTokens);
      const score = nameScore + descScore;
      if (score > bestProductScore) {
        bestProductScore = score;
        bestProduct = product;
      }
    }
    if (bestProduct && bestProductScore >= 0.5) {
      return `${bestProduct.name}: S/ ${decimalToString(bestProduct.price)}. Stock: ${bestProduct.stock} unidades. ${bestProduct.description ?? ''} 🛍️`;
    }

    if (ctx.services.length > 0) {
      const list = ctx.services.slice(0, 3).map(s => `${s.name}: S/ ${decimalToString(s.priceBase)}`).join(', ');
      return `Nuestros servicios principales: ${list} y más. ¿Sobre cuál te gustaría saber? 💁‍♀️`;
    }
  }

  // 2. Coloración — keywords específicas (evitar falsos positivos con "cabello" genérico)
  const colorKeywords = ['color', 'tinte', 'mechas', 'rubio', 'moreno', 'castano', 'rojo', 'negro', 'decolorar', 'matizar', 'iluminacion'];
  if (tokens.some((t) => colorKeywords.some((k) => t === k || t.startsWith(k)))) {
    const colorServices = ctx.services.filter(s => normalizeText(s.name).includes('color') || normalizeText(s.name).includes('tinte') || normalizeText(s.name).includes('mechas'));
    if (colorServices.length > 0) {
      const list = colorServices.map(s => `${s.name} (S/ ${decimalToString(s.priceBase)})`).join(', ');
      return `Para elegir el color de cabello ideal, es mejor que vengas a una consulta personalizada. Contamos con ${list}. Te recomiendo agendar una cita para que nuestro equipo te asesore según tu tono de piel y estilo 💇‍♀️✨`;
    }
    return `Para elegir el color de cabello ideal, te recomiendo agendar una cita para una consulta personalizada. Nuestro equipo te asesorará según tu tono de piel y estilo 💇‍♀️✨`;
  }

  const facialKeywords = ['piel', 'rostro', 'facial', 'acne', 'limpieza', 'hidratacion'];
  if (tokens.some((t) => facialKeywords.some((k) => t === k || t.startsWith(k)))) {
    const facialServices = ctx.services.filter(s => normalizeText(s.name).includes('facial') || normalizeText(s.description || '').includes('piel'));
    if (facialServices.length > 0) {
      const list = facialServices.map(s => `${s.name} (S/ ${decimalToString(s.priceBase)})`).join(', ');
      return `Tenemos excelentes tratamientos faciales: ${list}. Te recomiendo agendar una cita para que evaluemos tu tipo de piel y te recomendemos el mejor tratamiento 💆‍♀️`;
    }
    return `Contamos con tratamientos faciales personalizados según tu tipo de piel. Te recomiendo agendar una cita para una evaluación 💆‍♀️`;
  }

  const promoKeywords = ['promo', 'descuento', 'oferta', 'gratis', '2x1'];
  if (tokens.some((t) => promoKeywords.some((k) => t === k || t.startsWith(k)))) {
    if (ctx.promotions.length > 0) {
      const list = ctx.promotions.map(p => `${p.name}: ${p.type === 'PORCENTAJE' ? `${Number(p.value)}% OFF` : `S/ ${decimalToString(p.value)} OFF`}`).join(', ');
      return `¡Tenemos promociones activas! 🎉 ${list}. ¿Te gustaría reservar para aprovecharlas?`;
    }
    return `Por ahora no tenemos promociones activas, pero siguenos en redes para enterarte de las próximas 🔔`;
  }

  const productKeywords = ['producto', 'shampoo', 'acondicionador', 'crema', 'venta', 'tienda', 'comprar'];
  if (tokens.some((t) => productKeywords.some((k) => t === k || t.startsWith(k)))) {
    if (ctx.products.length > 0) {
      const list = ctx.products.slice(0, 3).map(p => `${p.name} (S/ ${decimalToString(p.price)})`).join(', ');
      return `Contamos con productos de calidad en nuestra tienda: ${list} y más. Visita /tienda para ver todo el catálogo 🛍️`;
    }
    return `Visita nuestra tienda online para ver los productos disponibles 🛍️`;
  }

  if (ctx.services.length > 0) {
    const list = ctx.services.slice(0, 3).map(s => `${s.name} (S/ ${decimalToString(s.priceBase)})`).join(', ');
    return `En Mora Spa ofrecemos: ${list} y más servicios. ¿Te gustaría reservar una cita o saber más de alguno? 💅`;
  }

  return `¡Hola! Soy el asistente virtual de Mora Spa 💋. ¿En qué puedo ayudarte hoy?`;
}
