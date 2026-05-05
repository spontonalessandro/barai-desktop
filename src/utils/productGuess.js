export function norm(value) {
  return String(value || '').trim().toLowerCase();
}

export function guessCategoria(descrizione) {
  const d = norm(descrizione);
  if (/vino|barbera|dolcetto|prosecco|spumante|champagne|nebbiolo|arneis|doc|docg/.test(d)) return 'Vini';
  if (/birra|ipa|lager|pils|weiss/.test(d)) return 'Birre';
  if (/caffe|caffè|orzo|ginseng|zucchero|the|tè|tisane/.test(d)) return 'Caffetteria';
  if (/pasta|riso|farina|olio|pomodor|mozzarella|latte|burro|formaggio|prosciutto|salame|carne|pollo|tonno/.test(d)) return 'Food';
  if (/deterg|sapone|carta|tovagliol|guanti|sacchi|pulizia/.test(d)) return 'Materiali e pulizie';
  return '';
}

export function guessPezziPerCartone(descrizione) {
  const d = norm(descrizione);
  if (!d) return 1;
  const patterns = [
    new RegExp('\\bx\\s*(\\d{1,3})\\b'),
    new RegExp('\\b(\\d{1,3})\\s*x\\b'),
    new RegExp('\\b(\\d{1,3})\\s*(?:pz|pezzi|bottiglie|bt|btl|lattine|vasetti|conf)\\b'),
    new RegExp('\\b(?:cartone|cart|ct|confezione|conf)\\s*(?:da|x)?\\s*(\\d{1,3})\\b'),
    new RegExp('\\b(\\d{1,3})\\s*(?:per|/)??\\s*(?:cartone|cart|ct|confezione|conf)\\b')
  ];
  for (const re of patterns) {
    const m = d.match(re);
    if (m && m[1]) {
      const n = Number(m[1]);
      if (Number.isFinite(n) && n > 1 && n <= 200) return n;
    }
  }
  return 1;
}

export function guessUm(descrizione, um) {
  if (um) return um;
  const d = norm(descrizione);
  if (/kg|kilo|chil/.test(d)) return 'KG';
  if (/lt|litro|l\b/.test(d)) return 'LT';
  if (/pz|pezzi|conf|cartone|bottiglie/.test(d)) return 'PZ';
  return '';
}


export function guessQuantitaPerUnita(descrizione, umBase = '') {
  const d = norm(descrizione).replace(',', '.');
  const um = String(umBase || '').toUpperCase();
  if (!d) return 1;

  if (um === 'KG') {
    const kg = d.match(/(\d+(?:\.\d+)?)\s*(?:kg|kilo|chilogramm?i?)\b/);
    if (kg) return Math.max(0.001, Number(kg[1]));
    const g = d.match(/(\d+(?:\.\d+)?)\s*(?:g|gr|gramm?i?)\b/);
    if (g) return Math.max(0.001, Number(g[1]) / 1000);
  }

  if (um === 'LT') {
    const lt = d.match(/(\d+(?:\.\d+)?)\s*(?:lt|l|litri?|litro)\b/);
    if (lt) return Math.max(0.001, Number(lt[1]));
    const cl = d.match(/(\d+(?:\.\d+)?)\s*(?:cl)\b/);
    if (cl) return Math.max(0.001, Number(cl[1]) / 100);
    const ml = d.match(/(\d+(?:\.\d+)?)\s*(?:ml)\b/);
    if (ml) return Math.max(0.001, Number(ml[1]) / 1000);
  }

  return 1;
}
