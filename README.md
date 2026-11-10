# Ipak Yo'li sarguzashti: 1-bosqich (Prototip)

1-bosqich: Ona qishloq. Xarita (7 nuqta), Hikmat bobo, sumka, kalit (3 qism), 2 ta mini-o'yin (bosh qotirma, puzzle), kalitni darvozaga sudrash va progressni brauzerda saqlash.

## Ishga tushirish

```bash
npm install
npm run dev          # http://localhost:5173 (telefonda: npm run dev -- --host)
npm test             # Vitest: 70 ta test
npm run typecheck    # TypeScript strict
npm run build        # dist/ papkasi
npm run test:e2e     # build'dan keyin real Chrome'da butun bosqichni o'ynab chiqadi
                     # (CHROME_PATH=/path/to/chrome bilan boshqa brauzer)
```

## Tuzilma

```
src/content/          MAZMUN (dasturchi kerak emas)
  levels.json         7 bosqich: to'siq, buyum, topshiriqlar tartibi
  items.json          buyumlar va ularning qismlari
  tasks/ona-qishloq.json  topshiriqlar: tiers.kichik / karvon / olim
  bobo.uz.json        bobo gaplari (matn + ixtiyoriy audio)
  pictures.ts         puzzle rasmlari (vaqtincha SVG)
  schema.ts           zod sxemalari va TS tiplari
  validate.ts         bog'lanish va pedagogik qoidalarni tekshirish
src/engine/           dvigatel (React'siz, sof funksiyalar)
  progress.ts         progress, sumka, yulduz, tanga, bosqich ochilishi, maslahat byudjeti
  rules.ts            sinf->daraja, yulduz formulasi, konstantalar
  storage.ts          localStorage (interfeys keyin IndexedDB+server bilan almashadi)
src/minigames/        Riddle, Puzzle; registry.ts orqali ulanadi
src/components/       Bobo, Sumka, ObstacleScene (darvoza), map/ (Phaser)
src/screens/          Register, Map, Level
e2e/play.mjs          real brauzer sinovi + skrinshotlar
```

## Mazmun qoidalari avtomatik tekshiriladi

Kontent xato bo'lsa, `npm test` yiqiladi va o'yin xabarni ekranga chiqaradi:

- har bir yosh darajasi kalitning 3 qismini ham yig'a oladi (zaif o'quvchi ham oxirigacha yetadi);
- topshiriqlar soni: kichik 3, karvon 4, olim 5;
- bir xil mini-o'yin ketma-ket 2 martadan ortiq kelmaydi, har darajada "dam olish" o'yini bor;
- bobo gaplarida va kichiklar savol/maslahatlarida har bir gap 10 so'zdan kam;
- maslahat javobni ichida saqlamaydi (bobo javobni aytmaydi);
- maqtov va dalda gaplari kamida 3 xil, ketma-ket takrorlanmaydi;
- barcha id, bobo kalitlari va rasmlar mavjud.

## Rejadan chetga chiqishlar va taxminlar

| Nima | Qaror | Sabab |
|---|---|---|
| Kalitni darvozaga sudrash animatsiyasi | React + SVG + CSS (Phaser emas) | Testing Library bilan sinab bo'ladi; sudrashga qo'shimcha "bos, keyin bos" usuli bor (7 yoshlilar va ekran o'quvchilar uchun). Xarita Phaser'da. |
| `item.parts` | `{id, name, icon}` obyektlari | UI qism nomini ko'rsatishi kerak. |
| Karvon/olim qo'shimcha topshiriqlari | `rewardPart`siz, faqat yulduz va tanga beradi | Kalitda 3 qism bor, karvonda esa 4, olimda 5 topshiriq. |
| Tanga | faqat birinchi bajarishda 10 ta | Qayta o'ynab tanga yig'ishning oldini olish uchun. Yulduz esa eng yaxshi natija bo'yicha saqlanadi. |
| Bobo ovozi | `audio` maydoni bor, MP3 yo'q | Ochiq savol. Fayl qo'yilsa o'zi ijro etadi. Kichiklarda ovoz yoqiq, kattalarda o'chiq. |
| Rasmlar | qo'lda chizilgan SVG va emoji | Ochiq savol (rassom). Kontent JSON o'zgarmaydi. |
| Ro'yxatdan o'tish | faqat ism va sinf (qurilmada) | Maktab va sinf kodi 4-bosqichda backend bilan qo'shiladi. |
| Mazmun matnlari | dasturchi qoralamasi | O'qituvchi tekshiruvi kerak (ochiq savol). |

2-bosqichga qoldirilganlar: moslashuvchan qiyinlik (3 xatodan keyin osonroq variant), vaqt bo'yicha bonus yulduz, PWA/offline kesh, sir sandiq, Phaser'ning yengil maxsus build'i.
