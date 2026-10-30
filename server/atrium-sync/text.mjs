/**
  * Copie de groupes/js/richtext.mjs (le service est déployé à plat sur le VPS).
 * Texte du catalogue (Atrium, GHL): entités HTML parfois doublement encodées
 * (&amp;eacute;) et balises <p>, <strong>... Ce module :
 *  - decodeEntities : décode jusqu'à stabilité (max 6 passes);
 *  - plainText      : décode + retire les balises (titres, cartes, attributs);
 *  - richHtml       : décode + HTML assaini (liste blanche p, br, strong, b, em, i,
 *                     ul, ol, li, a[href http/https/mailto/tel]). Tout le reste est
 *                     retiré (script/style avec leur contenu, attributs on*, style,
 *                     URL javascript:). Fonctionne sans DOM (navigateur et Node).
 */
const LATIN1 = 'nbsp iexcl cent pound curren yen brvbar sect uml copy ordf laquo not shy reg macr deg plusmn sup2 sup3 acute micro para middot cedil sup1 ordm raquo frac14 frac12 frac34 iquest Agrave Aacute Acirc Atilde Auml Aring AElig Ccedil Egrave Eacute Ecirc Euml Igrave Iacute Icirc Iuml ETH Ntilde Ograve Oacute Ocirc Otilde Ouml times Oslash Ugrave Uacute Ucirc Uuml Yacute THORN szlig agrave aacute acirc atilde auml aring aelig ccedil egrave eacute ecirc euml igrave iacute icirc iuml eth ntilde ograve oacute ocirc otilde ouml divide oslash ugrave uacute ucirc uuml yacute thorn yuml'.split(' ');
const NAMED = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", OElig: 'Œ', oelig: 'œ', Scaron: 'Š', scaron: 'š', Yuml: 'Ÿ', circ: 'ˆ', tilde: '˜', ensp: ' ', emsp: ' ', thinsp: ' ', zwnj: '', zwj: '', ndash: '–', mdash: '—', lsquo: '‘', rsquo: '’', sbquo: '‚', ldquo: '“', rdquo: '”', bdquo: '„', dagger: '†', Dagger: '‡', bull: '•', hellip: '…', permil: '‰', prime: '′', lsaquo: '‹', rsaquo: '›', euro: '€', trade: '™', larr: '←', rarr: '→', check: '✓' };
LATIN1.forEach((name, i) => { NAMED[name] = String.fromCharCode(160 + i); });

const ENTITY = /&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi;

function decodeOnce(text) {
  return text.replace(ENTITY, (match, body) => {
    if (body[0] === '#') {
      const code = body[1] === 'x' || body[1] === 'X' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff) return match;
      if (code === 160) return ' ';
      return String.fromCodePoint(code);
    }
    const value = NAMED[body] ?? NAMED[body.toLowerCase()];
    if (value === undefined) return match;
    return value === '\u00a0' ? ' ' : value;
  });
}

export function decodeEntities(value) {
  let text = String(value ?? '');
  for (let i = 0; i < 6; i += 1) {
    const next = decodeOnce(text);
    if (next === text) break;
    text = next;
  }
  return text;
}

function escText(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const DROP_WITH_CONTENT = /<(script|style|iframe|object|embed|noscript|template|svg|math)\b[\s\S]*?(<\/\1\s*>|$)/gi;
const COMMENT = /<!--[\s\S]*?(-->|$)/g;
const TAG = /<\/?([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g;
const ALLOWED = new Set(['p', 'br', 'strong', 'b', 'em', 'i', 'ul', 'ol', 'li', 'a']);
const BLOCK_BREAK = new Set(['div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'tr', 'table', 'section', 'article', 'blockquote']);

function cleanTags(text) {
  return text.replace(COMMENT, '').replace(DROP_WITH_CONTENT, '');
}

export function plainText(value) {
  const decoded = cleanTags(decodeEntities(value));
  return decoded
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|li|div|h[1-6])\s*>/gi, ' ')
    .replace(TAG, '')
    .replace(/[<>]/g, (c) => c) // pas d'autres balises reconnues: on garde le caractère, il sera échappé
    .replace(/[ \t\u00a0]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim();
}

function safeHref(raw) {
  const match = /\bhref\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(raw || '');
  if (!match) return '';
  const url = decodeEntities(match[2] ?? match[3] ?? match[4] ?? '').trim();
  const compact = url.replace(/[\u0000-\u0020]/g, '').toLowerCase();
  if (/^(https?:|mailto:|tel:)/.test(compact)) return url;
  return '';
}

export function richHtml(value) {
  const decoded = cleanTags(decodeEntities(value)).trim();
  if (!decoded) return '';
  if (!/<\/?[a-zA-Z][^>]*>/.test(decoded)) {
    // Texte brut: paragraphes sur lignes vides, <br> sur retours simples.
    return decoded.split(/\n\s*\n/).map((para) => `<p>${escText(para.trim()).replace(/\n/g, '<br>')}</p>`).join('');
  }
  const out = [];
  const stack = [];
  let last = 0;
  TAG.lastIndex = 0;
  let m;
  const pushText = (text) => { if (text) out.push(escText(text)); };
  while ((m = TAG.exec(decoded))) {
    pushText(decoded.slice(last, m.index));
    last = TAG.lastIndex;
    const closing = m[0][1] === '/';
    let name = m[1].toLowerCase();
    if (name === 'b') name = 'strong';
    if (name === 'i') name = 'em';
    if (!ALLOWED.has(name)) {
      if (BLOCK_BREAK.has(name) && closing) out.push('<br>');
      continue;
    }
    if (name === 'br') { out.push('<br>'); continue; }
    if (closing) {
      const at = stack.lastIndexOf(name);
      if (at === -1) continue;
      while (stack.length > at) out.push(`</${stack.pop()}>`);
      continue;
    }
    if (name === 'li' && !stack.some((t) => t === 'ul' || t === 'ol')) { out.push('<ul>'); stack.push('ul'); }
    if (name === 'a') {
      const href = safeHref(m[2]);
      if (!href) { out.push('<a>'); stack.push('a'); continue; }
      out.push(`<a href="${escText(href)}" target="_blank" rel="noopener nofollow">`);
    } else {
      out.push(`<${name}>`);
    }
    stack.push(name);
  }
  pushText(decoded.slice(last));
  while (stack.length) out.push(`</${stack.pop()}>`);
  return out.join('').replace(/(<br>\s*){3,}/g, '<br><br>');
}
