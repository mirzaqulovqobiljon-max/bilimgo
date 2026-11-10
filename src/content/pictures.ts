/**
 * Puzzle rasmlari. Prototipda rassom yo'q (ochiq savol), shuning uchun rasmlar
 * qo'lda chizilgan yengil SVG — tarmoqsiz ishlaydi va ~3 KB.
 * Keyinchalik bu yerga rassom chizgan WebP fayllar yo'li qo'yiladi; kontent JSON o'zgarmaydi.
 */
const qishloqDarvoza = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">
<defs>
<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7cc6e8"/><stop offset="1" stop-color="#d9f1fa"/></linearGradient>
<linearGradient id="wood" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8a4f24"/><stop offset="1" stop-color="#b06a35"/></linearGradient>
</defs>
<rect width="400" height="400" fill="url(#sky)"/>
<circle cx="330" cy="70" r="34" fill="#ffd34d"/>
<g fill="#fff" opacity=".9"><ellipse cx="80" cy="60" rx="38" ry="14"/><ellipse cx="108" cy="52" rx="26" ry="14"/><ellipse cx="220" cy="95" rx="30" ry="10"/></g>
<path d="M0 210 L70 120 L130 190 L200 100 L280 200 L340 130 L400 190 V260 H0Z" fill="#8fa6b8"/>
<path d="M175 130 L200 100 L225 130 L212 128 L200 140 L188 128Z" fill="#fff"/>
<rect y="240" width="400" height="160" fill="#9ccc65"/>
<path d="M160 400 C180 330 190 300 200 275 C210 300 220 330 240 400Z" fill="#e8c88f"/>
<g fill="#2e7d32"><ellipse cx="30" cy="190" rx="13" ry="60"/><ellipse cx="370" cy="185" rx="13" ry="62"/><ellipse cx="60" cy="205" rx="11" ry="48"/></g>
<g><rect x="20" y="230" width="90" height="60" fill="#e2b77a"/><rect x="14" y="222" width="102" height="12" fill="#a8743f"/><rect x="50" y="252" width="22" height="38" fill="#6d4c2f"/><rect x="84" y="246" width="16" height="16" fill="#4fc3f7"/></g>
<g><rect x="295" y="232" width="90" height="58" fill="#e2b77a"/><rect x="289" y="224" width="102" height="12" fill="#a8743f"/><rect x="305" y="246" width="16" height="16" fill="#4fc3f7"/><rect x="340" y="254" width="22" height="36" fill="#6d4c2f"/></g>
<rect x="118" y="170" width="28" height="130" fill="#c98b4f"/><rect x="254" y="170" width="28" height="130" fill="#c98b4f"/>
<path d="M110 175 Q200 95 290 175 L290 192 Q200 118 110 192Z" fill="#1e88a8"/>
<g fill="#ffd34d"><circle cx="150" cy="150" r="5"/><circle cx="200" cy="128" r="6"/><circle cx="250" cy="150" r="5"/></g>
<rect x="146" y="185" width="54" height="115" fill="url(#wood)"/><rect x="200" y="185" width="54" height="115" fill="url(#wood)"/>
<g stroke="#5d3317" stroke-width="3"><line x1="146" y1="215" x2="254" y2="215"/><line x1="146" y1="265" x2="254" y2="265"/><line x1="200" y1="185" x2="200" y2="300"/></g>
<rect x="190" y="232" width="20" height="22" rx="3" fill="#ffca28" stroke="#5d3317" stroke-width="2"/>
<circle cx="200" cy="241" r="3" fill="#5d3317"/><rect x="198.5" y="241" width="3" height="8" fill="#5d3317"/>
<g fill="#f06292"><circle cx="100" cy="320" r="6"/><circle cx="300" cy="330" r="6"/><circle cx="120" cy="360" r="5"/><circle cx="280" cy="365" r="5"/></g>
</svg>`;


const ormon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">
<rect width="400" height="400" fill="#bfe3c4"/><circle cx="320" cy="70" r="30" fill="#fff59d"/>
<g fill="#2e7d32"><path d="M40 300 L90 90 L140 300Z"/><path d="M260 300 L320 70 L380 300Z"/></g>
<g fill="#388e3c"><path d="M120 320 L180 120 L240 320Z"/><path d="M0 330 L40 170 L80 330Z"/><path d="M330 340 L370 190 L400 340Z"/></g>
<g fill="#6d4c2f"><rect x="84" y="300" width="12" height="40"/><rect x="174" y="320" width="12" height="30"/><rect x="314" y="300" width="12" height="40"/></g>
<rect y="330" width="400" height="70" fill="#7cb342"/>
<g fill="#ff7043"><circle cx="60" cy="360" r="7"/><circle cx="250" cy="372" r="7"/><circle cx="350" cy="365" r="6"/></g>
<g><ellipse cx="210" cy="365" rx="22" ry="14" fill="#a1887f"/><circle cx="228" cy="355" r="9" fill="#a1887f"/><circle cx="231" cy="352" r="2" fill="#000"/></g>
<g fill="#ffeb3b"><circle cx="150" cy="200" r="3"/><circle cx="280" cy="160" r="3"/><circle cx="60" cy="240" r="3"/></g>
<path d="M300 230 q10 -14 20 0 q10 -14 20 0" stroke="#5d4037" stroke-width="3" fill="none"/>
</svg>`;

const daryo = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">
<rect width="400" height="400" fill="#bfe3f2"/><circle cx="80" cy="70" r="30" fill="#ffd54f"/>
<path d="M0 170 L80 110 L150 160 L230 90 L320 150 L400 120 V200 H0Z" fill="#90a4ae"/>
<rect y="190" width="400" height="40" fill="#9ccc65"/>
<path d="M0 230 H400 V330 H0Z" fill="#4fa3d9"/>
<g stroke="#d6eefc" stroke-width="4" fill="none"><path d="M0 255 q25 -10 50 0 t50 0 t50 0 t50 0 t50 0 t50 0 t50 0 t50 0"/><path d="M0 300 q25 -10 50 0 t50 0 t50 0 t50 0 t50 0 t50 0 t50 0 t50 0"/></g>
<g><path d="M150 280 H260 L245 300 H165Z" fill="#8d5a2b"/><rect x="203" y="220" width="4" height="60" fill="#5d4037"/><path d="M207 222 L250 270 H207Z" fill="#fff"/></g>
<rect y="330" width="400" height="70" fill="#9ccc65"/>
<g fill="#2e7d32"><ellipse cx="40" cy="190" rx="14" ry="40"/><ellipse cx="360" cy="185" rx="14" ry="42"/></g>
<g fill="#ff8a65"><path d="M90 270 q10 -8 20 0 q-10 8 -20 0Z"/><path d="M310 310 q10 -8 20 0 q-10 8 -20 0Z"/></g>
</svg>`;

const chol = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">
<rect width="400" height="400" fill="#ffe0a3"/><circle cx="310" cy="80" r="40" fill="#ffb300"/>
<path d="M0 230 Q100 170 200 230 T400 220 V400 H0Z" fill="#e8b45e"/>
<path d="M0 290 Q120 240 240 295 T400 285 V400 H0Z" fill="#d89a45"/>
<g fill="#6d4c2f"><ellipse cx="150" cy="250" rx="40" ry="16"/><ellipse cx="140" cy="232" rx="14" ry="12"/><ellipse cx="164" cy="234" rx="12" ry="10"/>
<rect x="185" y="215" width="8" height="35"/><circle cx="196" cy="212" r="9"/>
<rect x="122" y="260" width="6" height="30"/><rect x="138" y="260" width="6" height="30"/><rect x="160" y="260" width="6" height="30"/><rect x="174" y="260" width="6" height="30"/></g>
<g fill="#558b2f"><rect x="60" y="300" width="14" height="60" rx="6"/><rect x="46" y="315" width="10" height="24" rx="5"/><rect x="78" y="308" width="10" height="24" rx="5"/></g>
<g fill="#4fc3f7"><ellipse cx="320" cy="330" rx="40" ry="12"/></g>
<g fill="#2e7d32"><ellipse cx="300" cy="300" rx="8" ry="28"/><ellipse cx="340" cy="300" rx="8" ry="30"/></g>
</svg>`;

const tog = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">
<rect width="400" height="400" fill="#c9e7f5"/><circle cx="70" cy="70" r="28" fill="#fff59d"/>
<path d="M0 300 L120 90 L230 300Z" fill="#78909c"/><path d="M150 300 L280 60 L400 300Z" fill="#607d8b"/>
<path d="M95 135 L120 90 L145 135 L130 128 L120 140 L110 128Z" fill="#fff"/><path d="M252 112 L280 60 L308 112 L292 104 L280 118 L268 104Z" fill="#fff"/>
<path d="M0 300 H170 L185 400 H0Z" fill="#8d6e63"/><path d="M230 300 H400 V400 H215Z" fill="#8d6e63"/>
<path d="M170 300 H230 L215 400 H185Z" fill="#37474f"/>
<path d="M170 302 Q200 330 230 302" stroke="#a1724a" stroke-width="5" fill="none"/>
<g fill="#5d4037"><circle cx="110" cy="290" r="6"/><rect x="106" y="294" width="8" height="12"/></g>
<g fill="#fff" opacity=".9"><ellipse cx="200" cy="40" rx="30" ry="10"/><ellipse cx="340" cy="150" rx="26" ry="9"/></g>
</svg>`;

const gor = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">
<rect width="400" height="400" fill="#4e4a63"/>
<path d="M0 0 H400 V120 Q300 70 200 110 Q100 70 0 120Z" fill="#2f2c40"/>
<path d="M60 400 Q60 170 200 150 Q340 170 340 400Z" fill="#1a1726"/>
<g fill="#7e57c2"><path d="M110 120 L120 165 L130 120Z"/><path d="M190 110 L200 170 L210 110Z"/><path d="M270 120 L280 160 L290 120Z"/></g>
<g><circle cx="170" cy="260" r="10" fill="#ffeb3b"/><circle cx="230" cy="260" r="10" fill="#ffeb3b"/><circle cx="172" cy="262" r="4" fill="#000"/><circle cx="232" cy="262" r="4" fill="#000"/></g>
<g fill="#ffd54f"><circle cx="110" cy="360" r="8"/><circle cx="125" cy="368" r="7"/><circle cx="300" cy="362" r="8"/></g>
<g fill="#8d6e63"><ellipse cx="40" cy="380" rx="40" ry="20"/><ellipse cx="370" cy="385" rx="40" ry="18"/></g>
<g fill="#ff7043"><path d="M30 300 q8 -20 16 0Z"/><rect x="36" y="300" width="4" height="30" fill="#6d4c2f"/><path d="M360 300 q8 -20 16 0Z"/><rect x="366" y="300" width="4" height="30" fill="#6d4c2f"/></g>
</svg>`;

const kitob = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">
<rect width="400" height="400" fill="#3f2b63"/>
<g fill="#ffd54f"><circle cx="50" cy="60" r="3"/><circle cx="350" cy="80" r="3"/><circle cx="300" cy="30" r="2"/><circle cx="90" cy="340" r="3"/><circle cx="340" cy="350" r="2"/></g>
<path d="M60 110 Q130 80 200 110 Q270 80 340 110 V320 Q270 290 200 320 Q130 290 60 320Z" fill="#8d5a2b"/>
<path d="M70 115 Q135 92 196 118 V310 Q135 285 70 305Z" fill="#fff8e1"/>
<path d="M204 118 Q265 92 330 115 V305 Q265 285 204 310Z" fill="#fff8e1"/>
<g stroke="#bca37a" stroke-width="3"><line x1="90" y1="150" x2="180" y2="160"/><line x1="90" y1="180" x2="180" y2="190"/><line x1="90" y1="210" x2="170" y2="218"/><line x1="90" y1="240" x2="180" y2="250"/>
<line x1="220" y1="160" x2="310" y2="150"/><line x1="220" y1="190" x2="310" y2="180"/><line x1="220" y1="250" x2="310" y2="240"/></g>
<text x="232" y="228" font-size="34" font-family="serif" fill="#1e88a8">A b</text>
<text x="100" y="285" font-size="30" font-family="serif" fill="#c8642d">1 2 3</text>
<path d="M200 110 V320" stroke="#5d3317" stroke-width="4"/>
<g fill="#ffeb3b" opacity=".85"><path d="M200 40 l8 24 h25 l-20 15 l8 24 l-21 -15 l-21 15 l8 -24 l-20 -15 h25Z"/></g>
</svg>`;

export const PICTURES: Record<string, string> = {
  'qishloq-darvoza': qishloqDarvoza,
  ormon,
  daryo,
  chol,
  tog,
  gor,
  kitob,
};

export const PICTURE_KEYS = Object.keys(PICTURES);

export function pictureUrl(key: string): string {
  const svg = PICTURES[key];
  if (!svg) throw new Error(`Rasm topilmadi: ${key}`);
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
