# Loyiha holati: 5 bosqich + rasm + ovoz (2026-11-11)

**Holat:** 5 bosqichning hammasi kodda tayyor va avtomatik sinovlardan o'tdi. Rasmlar (63 ta) va ovoz (189 ta yozuv) ham ulandi. **Bolalar va maktab bilan real sinovlar hali o'tkazilmagan.** Rejaga ko'ra keyingi qadam shu.

## Bosqichlar

| Bosqich | Nima qilindi | Avtomatik sinov | Real sinov |
|---|---|---|---|
| 1. Prototip | Ona qishloq: Phaser xaritasi, Hikmat bobo, sumka, kalit, bosh qotirma, puzzle, darvoza | ✓ | ⏳ 5–10 bola |
| 2. Mini-o'yinlar dvigateli | Qo'shildi: krossvord (to'r avtomatik), xotira kartalari, tartiblash, JSON avto-yuklovchi, moslashuvchan qiyinlik | ✓ | ⏳ 3 yosh guruhi |
| 3. To'liq sarguzasht | 7 bosqich × 3 daraja (35 topshiriq), 7 buyum, to'siq sahnalari, dev jangi, final, sertifikat | ✓ robot-o'yinchi + real Chrome | ⏳ bitta sinf |
| 4. Backend va o'qituvchi paneli | Express + PostgreSQL, sinf kodi bilan parolsiz kirish, offline→online sinxronlash, statistika | ✓ API + real brauzer | — |
| 5. Pilot | PWA (internetsiz), tezlik byudjetlari, qo'llanmalar | ✓ emulyatsiya | ⏳ 1–2 maktab |

## Ovoz (2026-11-11)

- **Ovozlar:**
  - Hikmat bobo: Voicelab "Amir", tezlik 0.9.
  - Dev: Voicelab "Qora Shoh", tezlik 1.0.
- **Yozuvlar:** 189 ta (166 ta bobo, 23 ta dev), jami ~11 daqiqa, 4.2 MB. Format: MP3, 48 kbps, mono, ovoz balandligi tenglashtirilgan.
- **Ovozlangan matnlar:**
  - bobo.uz.json'dagi hamma gaplar;
  - kichik darajadagi savollar, maslahatlar va topshiriq matnlari;
  - koddagi dinamik gaplar;
  - 3 darajadagi barcha dev savollari va devning 3 ta gapi.
- **Ovozlanmagan:** krossvorddagi "Bu so'z "X" harfi bilan boshlanadi" maslahatlari. Ular matn sifatida qoladi.
- **Ishlash tartibi:**
  - Audio matn bo'yicha topiladi (`src/content/audio.uz.json`), shuning uchun mazmun JSON fayllari o'zgarmaydi.
  - Kichik sayyohga savol avtomatik o'qib beriladi.
  - 🔊 tugmasi hamma darajada savolni qayta o'qiydi.
  - Karvonboshi va Olim uchun ovoz boshida o'chiq.
- **Yangi ibora ovozlash tartibi:** `tools/ovoz/manifest.py` → TTS → `import_results.py` → `build_index.py`.

## Sinov raqamlari

- Vitest: 159 ta test. Ulardan 12 tasi ovoz uchun: kanal mantiqi, har bir ovozlanadigan matnda fayl borligi, ortiqcha fayl yo'qligi.
- Server: 21 ta test.
- Real Chrome E2E:
  - o'yin;
  - to'liq sarguzasht (2-, 6-, 10-sinf);
  - backend;
  - perf;
  - ovoz (`e2e/voice.mjs`): MP3 yuklanadi va dekodlanadi, savol bobo gapidan keyin o'qiladi, ovoz o'chirilganda jim turadi.
- PWA keshi 7.1 MB, ovoz bilan birga. Shu sababli internetsiz ham gapiradi.

## Qarorlar va taxminlar

- Backend uchun Express tanlandi.
- To'siq va jang animatsiyalari React'da, xarita Phaser'da.
- Tanga faqat birinchi bajarishda beriladi.
- Sinxronlashda hamma narsa "faqat o'sadi".
- Ochiq savollar:
  - Bobo ovozi: sun'iy ovoz (Amir). Professional diktor yozsa, fayllarni almashtirish kifoya.
  - Mazmun dasturchi qoralamasi, o'qituvchilar tekshirishi kerak.
  - Domen hali hal qilinmagan.

## Hali qilinmagan

- Avatar do'koni, sir sandiq, kunlik vazifa, nishonlar.
- Qolgan 9 ta mini-o'yin.
- Kirill yozuvi va rus tili.
- Talaffuzni o'zbek tilida so'zlashuvchi bola yoki o'qituvchi tinglab tekshirishi.

## Android APK (2026-11-11)

- Capacitor 8 orqali yig'ildi: `android/` papkasi, `appId uz.ipakyoli.sarguzasht`, Android 7+, ekran faqat vertikal.
- APK GitHub Actions'da yig'iladi (`.github/workflows/android-apk.yml`): testlar → build → `cap sync` → `assembleDebug` → Release.
- Hozircha `mirzaqulovqobiljon-max/bilimgo` repo'sining `ipak-yoli-apk` branch'ida turibdi (repo public). Yuklab olish: Release `ipak-yoli-apk-latest`.
- Debug imzosi bor (v2), shuning uchun faqat sinov uchun. Play Market uchun release kaliti kerak bo'ladi.
- APK ichida server yo'q: o'yin to'liq internetsiz ishlaydi, lekin sinf kodi bilan kirish va o'qituvchi paneliga sinxronlash ishlamaydi. Buning uchun `VITE_API_URL` bilan haqiqiy server manzili berilishi kerak.
- Haqiqiy telefonda hali sinalmagan.

## 5 ta yangi mini-o'yin (2026-11-11)

Texnik topshiriq v1.0 va foydalanuvchi bergan PNG paketi asosida qo'shildi. Eski 35 ta topshiriq va avvalgi o'yinlar o'zgarmadi.
- **Sirli labirint** — Ona qishloq.
- **Yashirin buyumlar** — Qorong'i o'rmon.
- **Ot bilan to'siqlar** — Qizilqum.
- **Sehrli sandiq** — Baland tog'.
- **Dev bilan yakuniy jang** — Dev g'ori, 3 faza: savol, qalqon, sehrli belgilar.

Yangi o'yinlar "qo'shimcha sarguzasht" topshirig'i sifatida qo'shildi:
- buyum qismi bermaydi;
- yulduz va birinchi g'alabadagi tanga mavjud `recordTask` orqali beriladi;
- sertifikat chegarasi eskicha qoldi, qo'shimcha yulduzlar unda "bonus" bo'lib ko'rinadi.

Batafsil ma'lumot: `docs/mini-oyinlar.md`.

Sinov natijalari:
- 220 ta unit/UI test o'tdi.
- Chrome'da butun o'yin yangi o'yinlar bilan o'ynab chiqildi: telefonda 2-, 6- va 10-sinf, kompyuterda 2-, 6- va 10-sinf.
- Maket tekshiruvi: boboning gap pufagi asosiy tugmalarni yopmaydi.
- Ot yugurishi 60 FPS beradi, protsessor 4 baravar sekinlashtirilganda ham.

Sinovlar paytida topilgan va tuzatilgan kamchiliklar. Ular eski maketga ham tegishli edi:
- uzun gap pufagi oxirgi tugmani yopib qo'yardi;
- yangi ekran ochilganda sahifa tepaga qaytmasdi.
