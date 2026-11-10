# Ipak Yo'li sarguzashti

O'zbekiston maktablari (7–18 yosh) uchun ta'limiy sarguzasht o'yini. Bunda 7 bosqich, 3 yosh darajasi, 5 xil mini-o'yin, dev jangi va sertifikat bor. O'qituvchi paneli, sinf kodi bilan kirish va internetsiz ishlash ham qo'llab-quvvatlanadi.

## Holat (rejadagi 5 bosqich)

| Bosqich | Natija | Avtomatik sinov | Bolalar bilan sinov |
|---|---|---|---|
| 1. Prototip | Ona qishloq, xarita (Phaser), Hikmat bobo, sumka, kalit, bosh qotirma, puzzle | ✓ | ⏳ `docs/bolalar-bilan-sinov.md` |
| 2. Mini-o'yinlar dvigateli | + krossvord, xotira kartalari, tartiblash, JSON avto-yuklovchi, moslashuvchan qiyinlik | ✓ | ⏳ 3 yosh guruhida |
| 3. To'liq sarguzasht | 7 bosqich × 3 daraja (35 topshiriq), barcha buyumlar va to'siqlar, dev jangi, final, sertifikat | ✓ (robot-o'yinchi + real Chrome) | ⏳ bitta sinf bilan |
| 4. Backend va o'qituvchi paneli | Express + PostgreSQL, sinf kodi, sinxronlash, statistika | ✓ (API + offline/online) | — |
| 5. Pilot | PWA (internetsiz), "arzon telefon" tezlik byudjetlari, pilot materiallari | ✓ (emulyatsiya) | ⏳ `docs/pilot-rejasi.md` |

## Ishga tushirish

```bash
npm install
npm run dev                  # faqat o'yin (mehmon rejimi): http://localhost:5173

# server bilan (sinf kodi, o'qituvchi paneli):
npm run build
cd server && npm install && cp .env.example .env   # DATABASE_URL ni to'ldiring
npm run migrate && npm start                       # http://localhost:8080  (o'qituvchi: /#oqituvchi)
```

To'liq o'rnatish yo'riqnomasi: [`docs/ornatish.md`](docs/ornatish.md).

## Sinovlar

```bash
npm test                 # Vitest: dvigatel, mazmun qoidalari, komponentlar, 3 darajada butun o'yin (146)
npm run test:server      # API + offline→online sinxronlash, haqiqiy PostgreSQL bilan (21)
npm run build
node e2e/play.mjs        # 1-bosqich real Chrome'da (360×740)
npm run test:e2e:full    # 7 bosqich × 3 daraja real Chrome'da
node e2e/backend.mjs     # o'qituvchi → bola → INTERNETSIZ o'yin → sinxronlash → statistika
node e2e/perf.mjs        # CPU 6x sekin + Slow/Fast 3G: tezlik byudjetlari
```

## Tuzilma

```
src/content/        MAZMUN (JSON) + zod sxemalari + qoidalar validatori      → docs/mazmun-yozish.md
src/engine/         dvigatel: progress, qoidalar, moslashuvchan qiyinlik, birlashtirish (merge)
src/minigames/      Riddle, Puzzle, Crossword (+avtomatik to'r), Memory, Sorting — har biri alohida
src/components/     Hikmat bobo, sumka, to'siq sahnalari, dev jangi, sertifikat, xarita (Phaser)
src/screens/        ro'yxatdan o'tish / sinf kodi, xarita, bosqich
src/net/            API klient, IndexedDB navbat, sinxronlash
src/teacher/        o'qituvchi paneli (#oqituvchi)
server/             Express + PostgreSQL (migrations/, src/, test/)
e2e/                real brauzer sinovlari va tezlik sinovi
docs/               o'qituvchi qo'llanmasi, pilot rejasi, o'rnatish, mazmun yozish, bolalar bilan sinov
```

## Asosiy qarorlar va rejadan chetga chiqishlar

| Nima | Qaror | Sabab |
|---|---|---|
| Backend | Express (NestJS emas) | Rejada ikkalasiga ham ruxsat bor. Kichik API uchun Express yengilroq, oddiy va test qilish oson |
| To'siq va dev jangi animatsiyalari | React + SVG/CSS | Xarita Phaser'da. To'siq sahnalarini Testing Library bilan sinash mumkin, ularda "bos-bos" muqobil usuli bor |
| Qilich-qalqon (6 qism) | Bitta topshiriq 2 ta qism beradi | Kichiklarda atigi 3 ta topshiriq bor |
| Sehrli tumor | 3 qism (ko'k tosh, oltin zanjir, sehrli yozuv) | Rejada qismlari ko'rsatilmagan |
| Tanga | Faqat birinchi bajarishda | Qayta o'ynab tanga yig'ishning oldini olish uchun |
| Moslashuvchan qiyinlik | Kichiklar yuqori darajaga chiqarilmaydi | "Kichiklar uchun gap < 10 so'z" qoidasi |
| Dev jangi | Xato javob berilgan savol bitta savoldan keyin yana so'raladi | Bola uni o'rganib olishi uchun |
| Sinxronlash | Holatga asoslangan birlashtirish (faqat "o'sadi") | Offline navbatni qayta yuborish xavfsiz. "Hech narsa olib qo'yilmaydi" qoidasi kafolatlanadi |
| Bolalar kirishi | Sinf kodi + ro'yxatdan ism tanlash (parolsiz) | Rejaga mos. Kod tarqalsa, o'qituvchi yangilaydi |

**Hali qilinmaganlar:** avatar do'koni (tangalar sarflanadigan joy; `avatar_items` jadvali tayyor), sir sandiq, kunlik vazifa, nishonlar, qolgan 9 ta mini-o'yin, kirill yozuvi va rus tili (`bobo.uz-cyrl.json` va `bobo.ru.json` uchun tuzilma tayyor).

**Ochiq savollar** bo'yicha qilingan taxminlar:
- **Bobo ovozi:** `audio` maydoni bor, lekin MP3 fayllar yo'q.
- **Rasmlar:** qo'lda chizilgan SVG va emoji.
- **Mazmun:** dasturchi qoralamasi, fan o'qituvchilari tekshirishi kerak.
- **Domen:** alohida sayt sifatida mo'ljallangan, `base: './'` tufayli istalgan papkada ishlaydi.
