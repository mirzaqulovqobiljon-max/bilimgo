# Mazmun mualliflari uchun: topshiriq va bosqich qo'shish (dasturchisiz)

Butun mazmun `src/content/` papkasida turadi. **Kodni o'zgartirish kerak emas.**

| Fayl | Nima |
|---|---|
| `levels.json` | Bosqichlar: nomi, fani, to'sig'i, beradigan buyumi, topshiriqlar tartibi. Dev jangi savollari ham shu yerda |
| `items.json` | Buyumlar va ularning qismlari |
| `tasks/<bosqich>.json` | Topshiriqlar. Har bir topshiriqda `kichik` / `karvon` / `olim` uchun alohida mazmun bor |
| `bobo.uz.json` | Hikmat bobo gaplari (matn va ixtiyoriy MP3) |
| `pictures.ts` | Puzzle rasmlari |

## Mini-o'yinlar va ularning mazmuni

```jsonc
// Bosh qotirma
{ "questions": [ { "q": "Savol?", "options": ["A", "B", "C"], "answer": 1, "hint": "Yo'naltiruvchi maslahat", "picture": "🐟" } ] }
// Puzzle
{ "image": "daryo", "pieces": 9, "caption": "Katta daryo" }          // pieces: 4 | 9 | 16 | 25
// Krossvord (javob — bitta so'z; O' va G' bitta katak)
{ "words": [ { "q": "Suvda suzadi", "a": "BALIQ", "picture": "🐟" } ] }
// Xotira kartalari
{ "pairs": [ { "a": "Sigir", "b": "Buzoq" } ], "hint": "..." }
// Tartiblash (to'g'ri tartibda yozing — o'yin o'zi aralashtiradi)
{ "prompt": "...", "items": ["1-chi", "2-chi", "3-chi"], "topLabel": "Eng kichik", "bottomLabel": "Eng katta", "hint": "..." }
```

## Avtomatik tekshiriladigan qoidalar

Quyidagilardan biri buzilsa, `npm test` xato beradi va xatoning aniq joyini ko'rsatadi:

- Har bir yosh darajasi bosqich buyumining **barcha qismlarini** yig'a olishi kerak.
- Topshiriqlar soni: kichik — 3, karvon — 4, olim — 5.
- Bir xil mini-o'yin ketma-ket 2 martadan ortiq kelmaydi. Har bir darajada kamida bitta puzzle ("dam olish" o'yini) bor.
- **Maslahat javobni o'z ichiga olmaydi.** Bobo javobni aytmaydi.
- Kichiklar uchun (bobo gaplari, savollar, maslahatlar) **bitta gapda 10 so'zdan kam**.
- Krossvord so'zlari soni: kichik 4–5, karvon 8–10, olim 12–15. Savol ichida javob so'zi bo'lmasligi kerak.
- Dev jangida kamida 5 ta (olim uchun 7 ta) savol bo'lishi kerak.
- Barcha id va bobo kalitlari mavjud bo'lishi kerak. Maqtov va dalda gaplari kamida 3 xil.

## Yangi bosqich yoki "fasl" qo'shish

1. `levels.json` fayliga yozuv qo'shing: `order`, `obstacle`, `reward`, `tasks`.
2. Kerak bo'lsa, `items.json` fayliga yangi buyum qo'shing.
3. `tasks/<id>.json` faylini yarating. U avtomatik yuklanadi.
4. `bobo.uz.json` fayliga `bobo.<id>.intro`, `.obstacle`, `.outro` va `bobo.<buyum>.won` gaplarini qo'shing.
5. `npm test` buyrug'ini ishga tushiring. Yashil bo'lsa, tayyor.

## Bobo ovozi

Gapga `"audio": "audio/uz/daryo-intro.mp3"` maydonini qo'shing va faylni `public/audio/uz/` papkasiga qo'ying. Ovoz kichiklar uchun avtomatik yoqiladi, kattalarda esa ixtiyoriy.
