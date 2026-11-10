# 5-bosqich: pilot rejasi (2 hafta, 1–2 maktab)

## Pilotgacha bajarilgan avtomatik sinovlar

| Sinov | Natija |
|---|---|
| Vitest (o'yin dvigateli, mazmun qoidalari, komponentlar, 3 darajada butun o'yinni o'ynab chiqish) | 146 test ✓ |
| Server API (haqiqiy PostgreSQL) va offline→online sinxronlash | 21 test ✓ |
| Real Chrome, 360×740: 7 bosqich × 3 daraja | ✓ |
| Real Chrome + server: o'qituvchi sinf yaratadi → bola **internetsiz** o'ynaydi → natija serverga yetadi → o'qituvchi ko'radi | ✓ |
| "Arzon telefon" tezlik sinovi (pastda) | byudjet ichida ✓ |

### Tezlik sinovi: CPU 6 barobar sekin, 360×640 ekran (`node e2e/perf.mjs`)

| Ko'rsatkich | Slow 3G | Fast 3G | Byudjet |
|---|---|---|---|
| Birinchi ekran | ~4.5 s (109 KB) | ~1.5 s | ≤ 6 s / ≤ 3 s |
| Xarita tayyor | ~2.4 s | ~2.3 s | ≤ 15 s / ≤ 6 s |
| Xarita FPS | 37 | 39 | ≥ 24 |
| Bosishga javob | ~25 ms | ~30 ms | ≤ 200 ms |
| JS xotira | 17 MB | 17 MB | ≤ 80 MB |
| Internetsiz qayta ochish | ~1.4 s | ~1.6 s | ≤ 2.5 s |

Optimallashtirish natijasi: xaritaning statik foni teksturaga "pishirildi" va Phaser renderi 30 kadr bilan cheklandi. FPS 14 dan 37 ga ko'tarildi.

**Cheklov:** bu natijalar emulyatsiyada olingan. Haqiqiy arzon telefonlarda o'lchash pilotning birinchi vazifasi (pastda).

## Pilot jadvali

| Kun | Ish |
|---|---|
| 1-hafta, dushanba | Serverni o'rnatish (`docs/ornatish.md`). O'qituvchilarga 20 daqiqalik tanishtiruv (`docs/oqituvchi-qollanmasi.md`) |
| 1-hafta, seshanba | **Qurilmalar sinovi.** Sinfdagi har bir qurilma turida (eng arzon telefon, eski kompyuter) o'yinni ochib, 1-bosqichni o'ynab ko'rish. Pastdagi jadvalni to'ldirish |
| 1-hafta, chor–juma | Har sinfda kuniga 1 bosqich (dars yoki tanaffusda). Kuzatuvchi `docs/bolalar-bilan-sinov.md` varag'ini to'ldiradi |
| 2-hafta, dushanba | O'qituvchi panelidan "Qayerda qiynalishyapti?" ma'lumotini olish |
| 2-hafta, seshanba–payshanba | 4–7-bosqichlar, dev jangi, final va sertifikat |
| 2-hafta, juma | O'qituvchilar va bolalardan fikr olish (pastdagi savollar) |

## Qurilmalar jadvali (seshanba)

| Qurilma (model, yil) | Brauzer va versiya | Birinchi ochilish (s) | Xarita silliqmi? | Puzzle sudrash ishladimi? | Internetsiz qayta ochildimi? | Izoh |
|---|---|---|---|---|---|---|
| | | | | | | |

## Muvaffaqiyat mezonlari

- Bolalarning **≥ 80%** 1-bosqichni yordamsiz tugatadi.
- Bosqich o'rtacha **15–25 daqiqa** davom etadi.
- **≥ 90%** natija serverga yetib boradi. Buni o'qituvchi panelidagi yulduzlar bilan bolalar ekranidagi yulduzlarni solishtirib tekshiring.
- **"Qayerda qiynalishyapti?"** ro'yxatining eng yuqorisidagi 5 ta topshiriq tahlil qilinadi va kerak bo'lsa mazmun tuzatiladi.
- Pilot davomida birorta ham "ma'lumot yo'qoldi" holati bo'lmasligi kerak.

## O'qituvchilardan fikr (juma)

1. Kirish (sinf kodi) qanchalik oson bo'ldi? (1–5)
2. Statistika sizga dars uchun foydali bo'ldimi? Nima yetishmadi?
3. Qaysi topshiriqlarda mazmun xatosi yoki noaniqlik bor?
4. Qaysi topshiriq yosh darajasiga mos kelmadi (juda oson yoki juda qiyin)?
5. Darsda qaysi vaqtda ishlatish qulay: dars, tanaffus yoki uy vazifasi?

## Bolalardan fikr (og'zaki, 2–3 daqiqa)

1. Eng yoqqan o'yin qaysi bo'ldi?
2. Qayerda zerikding yoki qiynalding?
3. Hikmat bobo yordam berdimi?
4. Yana o'ynashni xohlaysanmi?

## Muammolar jurnali

| Sana | Maktab/sinf | Qurilma | Nima bo'ldi | Qayta takrorlanadimi? | Skrinshot |
|---|---|---|---|---|---|
| | | | | | |
