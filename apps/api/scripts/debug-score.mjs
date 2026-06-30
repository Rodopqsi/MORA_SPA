const normalizeText = (t) => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s]/g, '');
const tokenize = (t) => normalizeText(t).split(/\s+/).filter(w => w.length > 1);
const scoreMatch = (text, tokens) => {
  const haystack = normalizeText(text);
  return tokens.reduce((score, token) => {
    if (haystack.includes(token)) return score + 1;
    if (token.length >= 3 && haystack.split(/\s+/).some(w => w.startsWith(token.slice(0, 3)))) return score + 0.5;
    return score;
  }, 0);
};

const tokens = tokenize('cuanto cuesta un corte de cabello');
console.log('Tokens:', tokens);

const services = [
  { name: 'Barber fade y barbas', desc: 'Fade personalizado con perfilado y definicion de barba.' },
  { name: 'Coloracion de raiz', desc: 'Retoque de raiz con diagnostico previo y sellado de color.' },
  { name: 'Corte y brushing', desc: 'Lavado, corte personalizado y acabado con brushing.' },
  { name: 'Hidratacion profunda', desc: 'Tratamiento nutritivo para recuperar brillo, suavidad y elasticidad.' },
];

for (const s of services) {
  const scoreName = scoreMatch(s.name, tokens);
  const scoreDesc = scoreMatch(s.desc, tokens);
  console.log(`${s.name} => name:${scoreName} desc:${scoreDesc} total:${scoreName + scoreDesc}`);
}
