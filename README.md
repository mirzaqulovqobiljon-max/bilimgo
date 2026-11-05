# BilimGo — Android ilova

O‘zbekiston maktab o‘quvchilari uchun ingliz tilini o‘yin orqali o‘rganish ilovasining Android versiyasi.
Ilova **to‘liq offline** ishlaydi (INTERNET ruxsati ham so‘ralmaydi).

## APK ni yuklab olish
- **Actions** → oxirgi “Android APK” ishga tushishi → *Artifacts* → `BilimGo-apk`
- yoki **Releases** bo‘limidan (har bir `v*` teg uchun avtomatik chiqadi)

Yangi reliz chiqarish:
```bash
git tag v1.0.0 && git push origin v1.0.0
```

## Tuzilishi
| Fayl | Vazifasi |
|---|---|
| `web/bilimgo.html` | Asl web ilova (manba — o‘zgartirishlar shu yerda qilinadi) |
| `web/android-bridge.js` | `speechSynthesis` ni Android TTS ga ulaydi + “Orqaga” tugmasi mantiqi |
| `web/fonts/` | Nunito shrifti (offline) |
| `app/src/main/java/uz/bilimgo/app/MainActivity.java` | WebView, edge-to-edge, orqaga tugmasi |
| `app/src/main/java/uz/bilimgo/app/TtsBridge.java` | Android TextToSpeech ko‘prigi |

Yig‘ish vaqtida Gradle `prepareWebAssets` vazifasi `web/bilimgo.html` dan `assets/www/index.html` yasaydi:
Google Fonts havolasi lokal shriftga almashtiriladi va `android-bridge.js` qo‘shiladi.
Ya’ni web versiyani yangilash uchun faqat `web/bilimgo.html` ni almashtiring.

### Nega ko‘prik kerak
- **Talaffuz (TTS):** Android WebView Web Speech API ni qo‘llab-quvvatlamaydi (`getVoices()` bo‘sh, `speak()` jim).
  `TtsBridge` telefonning o‘z TextToSpeech dvigatelini ishlatadi; ingliz ovozi o‘rnatilmagan bo‘lsa, o‘rnatish oynasini ochadi.
- **Orqaga tugmasi:** ochiq oynani yopadi → darsdan chiqishni so‘raydi → ro‘yxatdan o‘tishda oldingi qadamga → bosh sahifaga;
  bosh sahifada 2 marta bosilsa ilova yopiladi.
- **Natijalar:** `localStorage` da, barqaror `https://appassets.androidplatform.net` origin orqali saqlanadi (WebViewAssetLoader).

## Lokal yig‘ish
Android Studio (JDK 17, Android SDK 35) bilan oching yoki:
```bash
./gradlew assembleRelease
```

## Imzolash (Play Market uchun)
Kalit berilmasa, APK debug kalit bilan imzolanadi (o‘rnatsa bo‘ladi, lekin Play Market uchun emas).
Doimiy kalit uchun repo **Settings → Secrets → Actions** ga qo‘shing:
`KEYSTORE_BASE64` (`base64 -w0 release.jks`), `KEYSTORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD`.

```bash
keytool -genkeypair -v -keystore release.jks -alias bilimgo -keyalg RSA -keysize 2048 -validity 10000
```

Minimal Android versiyasi: 7.0 (API 24). Target: Android 15 (API 35).
