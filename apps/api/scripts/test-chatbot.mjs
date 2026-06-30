/**
 * Script de prueba para el chatbot de Mora Spa.
 * Uso: node scripts/test-chatbot.mjs
 * O desde la raíz: cd apps/api && node scripts/test-chatbot.mjs
 */

const API_URL = process.env.API_URL || 'http://localhost:4000/api';

const testCases = [
  { message: 'hola', label: 'Saludo' },
  { message: 'Ver servicios', label: 'Solicitar servicios' },
  { message: 'Ver productos', label: 'Solicitar productos' },
  { message: 'Promociones', label: 'Solicitar promociones' },
  { message: 'cuánto cuesta un corte de cabello', label: 'Pregunta de precio' },
  { message: 'adios', label: 'Despedida' },
];

async function testChatbot() {
  console.log(`🧪 Testeando chatbot en ${API_URL}/public/chatbot\n`);

  for (const tc of testCases) {
    try {
      const res = await fetch(`${API_URL}/public/chatbot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: tc.message }),
      });

      if (!res.ok) {
        console.error(`❌ [${tc.label}] HTTP ${res.status}: ${await res.text()}`);
        continue;
      }

      const data = await res.json();
      const reply = data.data?.reply || '(sin reply)';
      const cards = data.data?.cards || [];
      const suggestions = data.data?.suggestions || [];

      console.log(`✅ [${tc.label}] «${tc.message}»`);
      console.log(`   Reply: ${reply.slice(0, 120)}${reply.length > 120 ? '…' : ''}`);
      console.log(`   Suggestions: ${suggestions.join(', ') || 'ninguno'}`);
      console.log(`   Cards: ${cards.length}`);
      if (cards.length > 0) {
        cards.forEach((c, i) => {
          const imgOk = c.imageUrl ? '✓' : '✗';
          console.log(`     ${i + 1}. [${imgOk}] ${c.title} (${c.type})`);
        });
      }
      console.log();
    } catch (err) {
      console.error(`❌ [${tc.label}] Error: ${err.message}`);
    }
  }

  console.log('🏁 Pruebas completadas.');
}

testChatbot();
