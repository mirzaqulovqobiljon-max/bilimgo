# Serverga o'rnatish

## Talablar

- Linux server: 1 vCPU va 1 GB RAM 1–2 maktab uchun yetarli.
- Node.js 20 yoki 22.
- PostgreSQL 14 yoki undan yangi.
- Domen va HTTPS (masalan, nginx + Let's Encrypt). PWA (internetsiz ishlash) faqat HTTPS orqali ishlaydi.

## O'rnatish

```bash
git clone <repo> ipak-yoli && cd ipak-yoli
npm ci && npm run build            # frontend -> dist/
cd server && npm ci

# baza
sudo -u postgres psql -c "CREATE USER ipak WITH PASSWORD 'KUCHLI-PAROL';"
sudo -u postgres psql -c "CREATE DATABASE ipak_yoli OWNER ipak;"

cp .env.example .env               # DATABASE_URL, TEACHER_INVITE ni to'ldiring
set -a && . ./.env && set +a
npm run migrate                    # jadvallar yaratiladi
npm start                          # http://localhost:8080 — o'yin ham, API ham
```

Server bitta jarayonda ishlaydi: o'yinni (`dist/`) ham, API'ni (`/api`) ham beradi.

## Doimiy ishlashi (systemd)

```ini
# /etc/systemd/system/ipak-yoli.service
[Unit]
Description=Ipak Yo'li sarguzashti
After=network.target postgresql.service

[Service]
WorkingDirectory=/srv/ipak-yoli/server
EnvironmentFile=/srv/ipak-yoli/server/.env
ExecStart=/usr/bin/node --import tsx src/main.ts
Restart=always
User=ipak

[Install]
WantedBy=multi-user.target
```

## nginx (HTTPS)

```nginx
server {
  server_name oyin.maktab.uz;
  location / { proxy_pass http://127.0.0.1:8080; proxy_set_header X-Forwarded-For $remote_addr; }
  listen 443 ssl; # certbot --nginx
}
```

## Zaxira nusxa (har kuni)

```bash
0 2 * * * pg_dump -Fc ipak_yoli > /backup/ipak_yoli_$(date +\%F).dump
```

## Yangilash

```bash
git pull && npm ci && npm run build && (cd server && npm ci && npm run migrate) && sudo systemctl restart ipak-yoli
```

Bolalar qurilmalari yangi versiyani keyingi ochilishda avtomatik oladi (PWA `autoUpdate`).

## Sinovlar

```bash
npm test                 # o'yin: 146 test
npm run test:server      # API + sinxronlash (PostgreSQL kerak; TEST_DATABASE_ADMIN_URL)
npm run build
node e2e/play.mjs        # 1-bosqich real brauzerda
npm run test:e2e:full    # 7 bosqich × 3 daraja real brauzerda
node e2e/backend.mjs     # o'qituvchi + bola + offline sinxronlash (DATABASE_URL)
node e2e/perf.mjs        # "arzon telefon" tezlik byudjetlari
```

E2E skriptlari Chrome'ni `/usr/bin/google-chrome` manzilidan qidiradi. Boshqa joyda bo'lsa, `CHROME_PATH` o'zgaruvchisi bilan ko'rsating.
