# MOMENT AI Backend

Fondasi backend MVP menggunakan NestJS, TypeScript strict, MongoDB/Mongoose, JWT, RBAC, Swagger, validasi input, Helmet, CORS, dan rate limiting.

## Menjalankan lokal

1. `npm install`
2. Salin `.env.example` menjadi `.env`, lalu isi `MONGODB_URI` dan `JWT_ACCESS_SECRET`.
3. `npm run start:dev`

API tersedia di `http://localhost:3000/api/v1`, health check di `/api/v1/health`, dan Swagger di `/docs`.

Registrasi publik hanya membuat role `PREGNANT_MOTHER`. Akun staf tidak dapat memilih role melalui endpoint publik.

Registrasi ibu hamil mengirim kode 6 digit melalui SMTP. Email harus diverifikasi sebelum login; nomor telepon tidak memerlukan verifikasi untuk sementara. Kode berlaku 15 menit dan dapat dikirim ulang. Isi `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, dan `EMAIL_FROM` pada `.env`. Untuk Gmail, gunakan `smtp.gmail.com`, port `587`, TLS (`SMTP_SECURE=false`), dan App Password sebagai `SMTP_PASSWORD`; jangan gunakan kata sandi login Gmail biasa. `EMAIL_FROM` sebaiknya sama dengan alamat `SMTP_USER`. Tanpa kredensial SMTP valid, registrasi dibatalkan dan backend mengembalikan detail kegagalan koneksi atau autentikasi. Pengaturan WAHA tetap tersedia untuk notifikasi WhatsApp lain, tetapi tidak digunakan untuk verifikasi registrasi.

## Kontrak registrasi, chat, dan skrining

Registrasi ibu hamil menerima data akun serta `nik`, `insuranceType` (`BPJS` atau `UMUM`), `birthplace`, `birthDate`, dan `address`. Jika memilih `BPJS`, `bpjsNumber` 13 digit wajib diisi. Data profil lain yang dapat dikirim: `education`, `occupation`, `bloodType`, `medicalHistory`, dan `lmpDate`. Profil kehamilan dibuat saat akun didaftarkan.

Chat menggunakan `POST /api/v1/chat/conversations` dengan `{ "kind": "AI" }` atau `{ "kind": "CARE_TEAM", "participantId": "<id>" }`, lalu `GET/POST /api/v1/chat/conversations/:id/messages`. Chat tim dibatasi pada pasien dan provider yang sudah ditugaskan. Jawaban AI memerlukan `CHAT_AI_ENDPOINT`, `CHAT_AI_API_KEY`, dan `CHAT_AI_MODEL`; endpoint harus kompatibel dengan format Chat Completions. Permintaan AI mewajibkan `consentToAiProcessing: true` dan mengirim teks percakapan ke penyedia yang dikonfigurasi.

Skrining nakes tersedia melalui `POST /api/v1/risk-assessments/evaluate` dengan `patientId`, `systolicMmHg`, `diastolicMmHg`, serta opsional `urineProteinPlus` (0–4) dan `warningSigns`. Riwayat dapat dibaca melalui `GET /api/v1/risk-assessments?patientId=<id>`. Hasil menyimpan MAP, kategori skrining, alasan, dan versi algoritme; hasil bukan diagnosis atau pengganti keputusan klinis.
