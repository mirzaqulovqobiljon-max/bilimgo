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

export const PICTURES: Record<string, string> = {
  'qishloq-darvoza': qishloqDarvoza,
};

export const PICTURE_KEYS = Object.keys(PICTURES);

export function pictureUrl(key: string): string {
  const svg = PICTURES[key];
  if (!svg) throw new Error(`Rasm topilmadi: ${key}`);
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
