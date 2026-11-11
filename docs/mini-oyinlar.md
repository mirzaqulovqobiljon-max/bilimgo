# 5 ta yangi mini-o'yin (texnik topshiriq v1.0, 11.11.2026)

Eski 7 bosqich, 35 topshiriq, 5 mini-o'yin, buyumlar va sertifikat **o'zgarmagan**. Yangi o'yinlar
har bosqichga **qo'shimcha sarguzasht topshirig'i** (`"extra": true`) bo'lib qo'shildi:

| O'yin | Bosqich | Kod | Darajalar (kichik / karvon / olim) |
|---|---|---|---|
| Sirli labirint | 1. Ona qishloq | `src/minigames/Maze.tsx`, `src/engine/maze.ts` | 9×9 / 13×13, 2 tuzoq / 17×17, 4 tuzoq (paketdagi JSON xaritalar) |
| Yashirin buyumlar | 2. Qorong'i o'rmon | `src/minigames/HiddenObjects.tsx` | 5 / 7 / 10 buyum; zoom, pan, ikki barmoq |
| Ot bilan to'siqlar | 4. Qizilqum | `src/minigames/HorseRunner.tsx`, `src/engine/runner.ts` | 5 / 8 / 12 to'siq; sekin / o'rta / tez |
| Sehrli sandiq | 5. Baland tog' | `src/minigames/MagicChest.tsx`, `src/engine/chest.ts` | 3 / 4 / 5 raqamli kod |
| Dev bilan yakuniy jang | 6. Dev g'ori (to'siq) | `src/components/DevBattle.tsx` (`finale`), `battle/ShieldPhase.tsx`, `battle/RunePhase.tsx` | savollar → qalqon → sehrli belgilar; HP 5 / 5 / 7 |

## Qoidalar
- Qo'shimcha topshiriq **qism bermaydi**: yulduz va birinchi g'alabada 10 tanga — mavjud `recordTask` orqali. Qayta o'ynash tanga bermaydi.
- Asosiy 3/4/5 topshiriq qoidasi, qismlar taqsimoti va sertifikat chegarasi (`maxStarsFor`) faqat asosiy topshiriqlardan hisoblanadi; qo'shimcha yulduzlar sertifikatda "bonus" bo'lib ko'rinadi.
- Har o'yin `onDone({ mistakes, allowance })` ni aynan bir marta chaqiradi (testlar tekshiradi).
- Kichiklarda: noto'g'ri bosish jazolanmaydi (yashirin buyumlar), ot yugurishida mashq va keng sakrash oynasi (~0.39 s), cheksiz maslahat; dev o'ldirilmaydi — kechirim so'raydi.
- Eski `DevBattle` (finale'siz) o'zgarmagan — uning testlari avvalgidek o'tadi.

## Boshqaruv
| O'yin | Kompyuter | Telefon |
|---|---|---|
| Labirint | ↑↓←→ yoki WASD | ekrandagi 4 tugma, katakka tegish, barmoq surish |
| Yashirin buyumlar | sichqoncha, g'ildirak (zoom) | tegish, ikki barmoq (zoom), sudrash |
| Ot | Space / ↑, P — pauza | "SAKRASH" tugmasi yoki ekranga tegish |
| Sandiq | raqam tugmalari, ↑↓←→, Enter | ▲ / ▼ |
| Jang | Space — qalqon | "Qalqon" tugmasi, belgilarga tegish |

## Rasmlar
`python3 -I tools/minioyin_rasmlar.py <paket_papkasi>` — PNG paketidan `public/img/minigames/*.webp`.
Ot, xoda va yulduz OpenCV GrabCut bilan sahnadan ajratilgan; fon — sahnaning ot yo'q qismi.
Yashirin buyumlar koordinatalari (0..1) sahna rasmiga qarab qo'lda belgilangan va tekshirilgan.

## Sinov
- `npm test` — 220 unit/UI test (yangi: `src/engine/newgames.test.ts`, `src/minigames/newgames.test.tsx`).
- `node e2e/full.mjs 2|6|10` (telefon), `VIEWPORT=desktop node e2e/full.mjs 6` — butun o'yin, yangi o'yinlar bilan, haqiqiy Chrome'da.
- `node e2e/layout.mjs` — har o'yinning asosiy tugmalari bobo pufagi ostida qolmasligi (telefon va kompyuter).
- `node e2e/runner-fps.mjs` — ot yugurishi: 60 FPS, 4× sekin protsessorda ham 60 FPS.
