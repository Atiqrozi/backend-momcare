# MOMENT AI — Backend Requirements

> **Produk:** MOMENT AI (*Maternal Journey Assistant*)  
> **Dokumen:** Spesifikasi kebutuhan backend dan REST API  
> **Status:** Draft awal untuk MVP Hackathon  
> **Backend stack:** NestJS, TypeScript, MongoDB Atlas, Mongoose, Swagger/OpenAPI  
> **Referensi:** Proposal Hackathon MOMENT AI dan prototype UI/UX [MOMENT AI – Dashboard Tenaga Kesehatan](https://moment-ai-nakes.vercel.app/)

---

## 1. Ringkasan Proyek

MOMENT AI adalah platform pendampingan kesehatan maternal yang membantu ibu hamil memantau perjalanan kehamilan, mengelola jadwal Antenatal Care (ANC), memperoleh edukasi kesehatan ibu dan anak, serta mengakses informasi layanan rumah sakit. Aplikasi juga menyediakan dashboard bagi tenaga kesehatan untuk memantau jadwal dan status kunjungan serta mengidentifikasi pasien yang berpotensi melewatkan pemeriksaan.

Backend bertugas menyediakan REST API yang aman untuk aplikasi mobile dan dashboard tenaga kesehatan, menyimpan data, menerapkan aturan bisnis, dan menjadi titik integrasi layanan notifikasi maupun komponen AI apabila fitur tersebut diimplementasikan pada tahap berikutnya.

### 1.1 Tujuan backend

- Menyediakan API terpusat untuk aplikasi MOMENT AI.
- Mengelola autentikasi, otorisasi berbasis peran, dan profil pengguna.
- Menyimpan jurnal kehamilan, riwayat pemeriksaan, status vaksinasi, serta jadwal ANC.
- Mendukung pengingat jadwal dan pencatatan status pengiriman notifikasi.
- Menyajikan materi edukasi dan informasi layanan rumah sakit.
- Menyediakan data ringkasan untuk Healthcare Provider Dashboard.
- Mendukung penggunaan data simulasi pada MVP tanpa mewajibkan integrasi SIMRS.
- Menjaga kerahasiaan dan keamanan data pribadi serta data kesehatan.

### 1.2 Batasan MVP

1. MVP boleh menggunakan data dummy/sintetis untuk demonstrasi dan pengujian.
2. Integrasi penuh dengan SIMRS bukan persyaratan MVP.
3. Pengiriman WhatsApp/SMS harus melalui provider resmi dan konfigurasi kredensial yang sah. Jika provider belum tersedia, sistem tetap harus dapat mencatat notifikasi sebagai `pending`, `sent`, atau `failed` melalui adapter/mock untuk demo.
4. Konten kesehatan mengacu pada Buku Kesehatan Ibu dan Anak (Buku KIA) Kementerian Kesehatan RI dan harus melalui peninjauan tenaga kesehatan sebelum dipublikasikan.
5. MOMENT AI merupakan sistem pendukung pelayanan. Backend tidak boleh mengklaim diagnosis, menentukan tindakan klinis otomatis, atau menggantikan pemeriksaan dan keputusan tenaga kesehatan.
6. Chatbot AI, OCR dokumen medis, dan integrasi model AI tidak dianggap sebagai fitur wajib MVP kecuali disepakati sebagai ruang lingkup tambahan.

---

## 2. Teknologi dan Dependensi

| Komponen | Pilihan |
|---|---|
| Runtime | Node.js LTS yang kompatibel dengan versi NestJS yang digunakan |
| Framework | NestJS |
| Bahasa | TypeScript dengan `strict` mode |
| Database | MongoDB Atlas |
| ODM | Mongoose melalui `@nestjs/mongoose` |
| API style | REST API, JSON |
| API documentation | `@nestjs/swagger` dan OpenAPI |
| Authentication | JWT access token |
| Password hashing | Argon2 atau bcrypt |
| Request validation | `class-validator` dan `class-transformer` |
| Configuration | `@nestjs/config` dan environment variables |
| Scheduling | `@nestjs/schedule` untuk pemeriksaan jadwal reminder |
| Logging | NestJS Logger; log terstruktur untuk production |
| Testing | Jest dan Supertest |
| Code quality | ESLint, Prettier |
| Version control | Git dan GitHub |

Versi paket harus dikunci melalui lockfile (`package-lock.json` atau package manager yang dipilih). Jangan menggunakan versi paket yang tidak kompatibel hanya karena versi tersebut tercantum pada dokumen ini.

### 2.1 Prinsip arsitektur

- Gunakan pendekatan **modular monolith** pada MVP agar pengembangan dan deployment sederhana.
- Pisahkan controller, service, schema/model, DTO, guard, dan integrasi eksternal.
- Controller menangani HTTP request/response; business logic ditempatkan di service.
- Akses database dilakukan melalui service/repository berbasis Mongoose.
- Seluruh route menggunakan prefix `/api/v1`.
- Gunakan UTC untuk penyimpanan waktu di database dan ISO 8601 pada API. Konversi ke zona waktu lokal dilakukan pada layer tampilan atau sesuai kebutuhan reminder.
- Semua data pasien harus terikat pada identitas pasien dan/atau fasilitas kesehatan yang berwenang mengaksesnya.

---

## 3. Peran Pengguna dan Hak Akses

Gunakan Role-Based Access Control (RBAC). Minimal tersedia peran berikut:

| Role | Hak akses utama |
|---|---|
| `PREGNANT_MOTHER` | Mengelola profil dan jurnal kehamilan sendiri, melihat jadwal ANC, status vaksinasi, edukasi, dan informasi layanan |
| `MIDWIFE` | Melihat pasien yang menjadi tanggung jawabnya, jadwal dan status ANC, serta data yang diperlukan untuk tindak lanjut |
| `DOCTOR` | Melihat pasien yang berada dalam cakupan pelayanan dan informasi kesehatan yang diizinkan |
| `ADMIN` | Mengelola akun dan data master sesuai kewenangan administrasi |
| `CONTENT_EDITOR` | Membuat dan memperbarui draf materi edukasi serta informasi layanan |
| `CLINICAL_REVIEWER` | Meninjau dan menyetujui konten edukasi sebelum dipublikasikan |

Aturan otorisasi wajib:

- Ibu hamil hanya dapat membaca atau mengubah data miliknya sendiri.
- Tenaga kesehatan hanya dapat mengakses data pasien yang berada dalam cakupan penugasan/fasilitasnya.
- Hak admin tidak otomatis berarti semua data klinis boleh dibaca tanpa pembatasan; akses harus mengikuti kebutuhan dan kebijakan rumah sakit.
- Endpoint admin dan reviewer harus dilindungi guard dan role yang sesuai.
- Jangan menerima `userId`, `patientId`, `role`, atau `facilityId` dari request sebagai bukti otorisasi. Identitas aktor harus berasal dari token terverifikasi dan relasi akses harus divalidasi di server.

---

## 4. Modul Backend

### 4.1 Authentication & Authorization

Fungsi:
- Registrasi dan login.
- Hash password sebelum disimpan.
- Penerbitan JWT access token.
- Endpoint untuk mengambil profil pengguna yang sedang login.
- Guard untuk autentikasi dan role.
- Logout dapat dilakukan di sisi klien untuk MVP berbasis access token; jika diperlukan pencabutan token, tambahkan refresh-token/session store pada tahap berikutnya.

### 4.2 User & Patient Profile

Menyimpan data akun dan profil ibu hamil yang diperlukan oleh fitur aplikasi.

Data minimum:
- Nama lengkap.
- Email atau nomor telepon yang telah diverifikasi sesuai metode login.
- Role.
- Status akun.
- Tanggal perkiraan persalinan (*estimated due date/EDD*), jika sudah diketahui.
- Tanggal hari pertama haid terakhir (HPHT/LMP), jika tersedia dan diberikan secara sukarela.
- Fasilitas kesehatan terkait, jika relevan.
- Persetujuan penggunaan data dan waktu persetujuan.

Data sensitif tidak boleh dikumpulkan jika tidak dibutuhkan untuk fitur MVP. Jangan menyimpan NIK atau identitas sensitif lainnya hanya untuk keperluan demo.

### 4.3 Pregnancy Journey Tracker

Mendukung:
- Jurnal kehamilan harian.
- Catatan gejala atau keluhan yang dilaporkan pengguna.
- Riwayat pemeriksaan yang dimasukkan atau disahkan oleh pihak berwenang.
- Catatan pengukuran seperti berat badan dan tekanan darah jika disetujui untuk ruang lingkup MVP.
- Status dan jadwal vaksinasi.
- Timeline kehamilan berdasarkan tanggal yang tersedia.

Catatan jurnal pengguna tidak boleh otomatis diperlakukan sebagai diagnosis. Riwayat medis yang dimasukkan oleh pasien harus dibedakan dari hasil pemeriksaan yang dicatat atau diverifikasi tenaga kesehatan.

### 4.4 Smart ANC Reminder

Mendukung:
- Membuat dan mengelola jadwal pemeriksaan ANC.
- Menetapkan dokter/bidan atau lokasi layanan jika tersedia.
- Status jadwal: `scheduled`, `confirmed`, `completed`, `missed`, `cancelled`, atau `rescheduled`.
- Mengatur waktu pengingat.
- Menyimpan riwayat percobaan dan status pengiriman notifikasi.
- Menghindari pengiriman notifikasi ganda untuk jadwal dan kanal yang sama.
- Mengidentifikasi jadwal yang telah lewat dan berpotensi membutuhkan tindak lanjut.

Penjadwalan pengingat harus menggunakan waktu yang jelas dan zona waktu yang terdefinisi. Untuk MVP, interval pengingat dapat berupa konfigurasi sistem, bukan aturan klinis yang dibuat oleh AI.

### 4.5 Maternal Education Center

Mendukung:
- Daftar dan detail artikel/materi.
- Kategori seperti nutrisi, pemeriksaan kehamilan, tanda bahaya, persiapan persalinan, ASI, dan perawatan bayi baru lahir.
- Metadata sumber, misalnya Buku KIA Kementerian Kesehatan RI.
- Status konten: `draft`, `in_review`, `published`, `archived`.
- Alur peninjauan oleh `CLINICAL_REVIEWER`.
- Pencatatan pembuat dan waktu perubahan konten.

Hanya konten berstatus `published` yang dapat ditampilkan kepada pengguna umum. Simpan sumber dan informasi versi agar materi dapat ditinjau dan diperbarui.

### 4.6 Hospital Service

Menyediakan informasi layanan rumah sakit:
- Nama layanan dan deskripsi.
- Unit/departemen.
- Jam layanan bila tersedia.
- Kontak resmi dan lokasi.
- Petunjuk/alur layanan.
- Status publikasi dan waktu pembaruan.

Informasi layanan harus dapat dikelola oleh admin yang berwenang dan tidak boleh mengarang jadwal, tarif, atau ketersediaan dokter yang belum diverifikasi.

### 4.7 Healthcare Provider Dashboard

Menyediakan data agregat dan daftar kerja untuk tenaga kesehatan:
- Jumlah pasien yang berada dalam cakupan akses pengguna.
- Jadwal ANC hari ini dan rentang tanggal yang dipilih.
- Ringkasan status kunjungan.
- Daftar jadwal terlewat yang memerlukan peninjauan/tindak lanjut.
- Riwayat status kunjungan.
- Filter berdasarkan tanggal, status, dan tenaga kesehatan yang berwenang.

Dashboard tidak boleh menampilkan data lintas fasilitas atau pasien yang tidak memiliki relasi akses. Data ringkasan harus dihitung dari data kunjungan, bukan disimpan sebagai angka manual yang berpotensi tidak sinkron.

### 4.8 Notification Module

Buat abstraksi `NotificationProvider` agar provider WhatsApp/SMS dapat diganti tanpa mengubah business logic.

Data notifikasi minimum:
- Penerima dan referensi pengguna.
- Referensi jadwal ANC.
- Kanal (`whatsapp`, `sms`, atau `in_app`).
- Waktu terjadwal dan waktu pengiriman.
- Status (`pending`, `sent`, `failed`, `cancelled`).
- ID pesan dari provider bila tersedia.
- Pesan kesalahan yang telah disanitasi.

Jangan menyimpan API key provider dalam database atau source code. Hindari memasukkan detail klinis sensitif ke dalam pesan notifikasi. Pesan default cukup mengingatkan jadwal dan mengarahkan pengguna ke kanal resmi.

---

## 5. Rancangan Data MongoDB

Gunakan collection terpisah untuk entitas utama. Nama collection dapat mengikuti pluralisasi Mongoose.

### 5.1 `users`

| Field | Tipe | Keterangan |
|---|---|---|
| `_id` | ObjectId | ID internal |
| `fullName` | string | Nama lengkap |
| `email` | string, optional | Email yang dinormalisasi |
| `phone` | string, optional | Nomor telepon dengan format konsisten |
| `passwordHash` | string | Hash password, tidak pernah dikirim melalui API |
| `role` | enum | Role pengguna |
| `status` | enum | `active`, `inactive`, `suspended` |
| `facilityId` | ObjectId, optional | Fasilitas terkait |
| `consent` | object | Status, versi teks persetujuan, waktu persetujuan |
| `createdAt`, `updatedAt` | Date | Timestamp |

Tambahkan unique index pada email/nomor telepon yang digunakan untuk login, dengan memperhatikan field yang optional. Jangan menyimpan password plaintext.

### 5.2 `pregnancyProfiles`

| Field | Tipe | Keterangan |
|---|---|---|
| `userId` | ObjectId | Referensi ke `users` |
| `lmpDate` | Date, optional | HPHT jika tersedia |
| `estimatedDueDate` | Date, optional | Perkiraan tanggal persalinan |
| `pregnancyStatus` | enum | `ongoing`, `postpartum`, `completed` |
| `assignedProviderIds` | ObjectId[] | Tenaga kesehatan yang diizinkan terkait |
| `facilityId` | ObjectId, optional | Fasilitas pelayanan |
| `createdAt`, `updatedAt` | Date | Timestamp |

### 5.3 `pregnancyJournals`

| Field | Tipe | Keterangan |
|---|---|---|
| `patientId` | ObjectId | Pemilik catatan |
| `entryDate` | Date | Tanggal jurnal |
| `mood` | string, optional | Suasana hati yang dilaporkan |
| `symptoms` | string[] | Gejala/keluhan yang dilaporkan |
| `notes` | string, optional | Catatan pengguna |
| `createdAt`, `updatedAt` | Date | Timestamp |

Batasi panjang `notes` dan jumlah item gejala. Jangan menyimpulkan kondisi medis otomatis dari catatan ini.

### 5.4 `medicalRecords`

| Field | Tipe | Keterangan |
|---|---|---|
| `patientId` | ObjectId | Pasien |
| `recordDate` | Date | Tanggal pemeriksaan |
| `recordType` | enum/string | Jenis catatan |
| `summary` | string | Ringkasan yang diizinkan |
| `measurements` | object, optional | Pengukuran terstruktur yang disepakati |
| `recordedBy` | ObjectId | Aktor pencatat |
| `verificationStatus` | enum | `patient_reported`, `pending_review`, `verified` |
| `facilityId` | ObjectId, optional | Fasilitas terkait |
| `createdAt`, `updatedAt` | Date | Timestamp |

Field dan format `measurements` harus dibatasi melalui DTO. Jangan menganggap unggahan atau input pasien sebagai catatan terverifikasi.

### 5.5 `vaccinations`

Field utama: `patientId`, `vaccineName`, `scheduledDate`, `administeredDate`, `status`, `notes` (opsional), `recordedBy`, `facilityId`, `createdAt`, dan `updatedAt`.

Status awal yang disarankan: `planned`, `scheduled`, `completed`, `skipped`, `cancelled`. Daftar vaksin dan aturan jadwal harus berasal dari sumber resmi/validasi tenaga kesehatan, bukan dibuat sendiri oleh AI.

### 5.6 `ancAppointments`

| Field | Tipe | Keterangan |
|---|---|---|
| `patientId` | ObjectId | Pasien |
| `providerId` | ObjectId, optional | Dokter/bidan |
| `facilityId` | ObjectId | Fasilitas layanan |
| `scheduledAt` | Date | Waktu pemeriksaan |
| `status` | enum | Status kunjungan |
| `visitType` | string, optional | Jenis kunjungan |
| `notes` | string, optional | Catatan administratif yang relevan |
| `createdBy` | ObjectId | Pembuat jadwal |
| `createdAt`, `updatedAt` | Date | Timestamp |

### 5.7 `notifications`

Field utama: `userId`, `appointmentId`, `channel`, `scheduledAt`, `sentAt`, `status`, `providerMessageId`, `attemptCount`, `lastError`, `idempotencyKey`, `createdAt`, dan `updatedAt`.

Gunakan unique index pada `idempotencyKey` untuk mencegah notifikasi duplikat.

### 5.8 `educationContents`

Field utama: `title`, `slug`, `summary`, `body`, `category`, `sourceTitle`, `sourceUrl` (opsional), `sourceVersion` (opsional), `status`, `createdBy`, `reviewedBy`, `reviewedAt`, `publishedAt`, `createdAt`, dan `updatedAt`.

### 5.9 `hospitalServices`

Field utama: `name`, `slug`, `description`, `department`, `addressOrLocation`, `contactPhone`, `operatingHours`, `instructions`, `status`, `updatedBy`, `createdAt`, dan `updatedAt`.

### 5.10 `auditLogs`

Catat aktivitas penting seperti login berhasil/gagal, perubahan role, perubahan jadwal, akses atau perubahan rekam medis, persetujuan konten, serta perubahan data sensitif.

Field minimum: `actorId`, `action`, `resourceType`, `resourceId`, `timestamp`, `requestId`, dan metadata aman yang tidak memuat password, token, atau isi rekam medis secara berlebihan. Batasi akses terhadap log dan tetapkan kebijakan retensi.

---

## 6. Konvensi REST API

- Base URL lokal: `http://localhost:3000/api/v1`
- Format payload: JSON.
- Tanggal/waktu: ISO 8601, misalnya `2026-11-02T03:00:00.000Z`.
- Autentikasi: `Authorization: Bearer <access_token>`.
- Pagination list: `page` dan `limit`.
- Batas default `limit`: 20; batas maksimum: 100.
- Filter dan sort harus menggunakan field yang diizinkan, bukan ekspresi database dari input pengguna.
- Gunakan status HTTP secara konsisten.
- Jangan mengirim `passwordHash`, token, rahasia provider, atau data internal audit pada response publik.

### 6.1 Bentuk response sukses

```json
{
  "success": true,
  "message": "Data berhasil diambil",
  "data": {},
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 0
  }
}
```

`meta` dapat dihilangkan pada endpoint detail atau aksi tunggal.

### 6.2 Bentuk response error

```json
{
  "success": false,
  "message": "Validasi gagal",
  "statusCode": 400,
  "error": "Bad Request",
  "details": [
    {
      "field": "scheduledAt",
      "messages": ["scheduledAt harus berupa tanggal ISO 8601 yang valid"]
    }
  ],
  "requestId": "request-id"
}
```

Jangan mengirim stack trace atau detail internal database ke klien pada production.

### 6.3 Status HTTP

| Status | Penggunaan |
|---|---|
| `200 OK` | Pengambilan atau pembaruan berhasil |
| `201 Created` | Resource berhasil dibuat |
| `204 No Content` | Penghapusan/aksi berhasil tanpa response body, jika sesuai |
| `400 Bad Request` | Payload atau query tidak valid |
| `401 Unauthorized` | Token tidak ada atau tidak valid |
| `403 Forbidden` | Tidak memiliki izin |
| `404 Not Found` | Resource tidak ditemukan atau tidak dapat diakses sesuai kebijakan |
| `409 Conflict` | Duplikasi atau konflik status |
| `422 Unprocessable Entity` | Data valid secara format tetapi tidak memenuhi aturan bisnis, jika digunakan konsisten |
| `429 Too Many Requests` | Rate limit tercapai |
| `500 Internal Server Error` | Kesalahan server tak terduga |

---

## 7. Daftar Endpoint API

Semua endpoint di bawah menggunakan prefix `/api/v1`. Endpoint bertanda **Auth** memerlukan JWT; izin role dan cakupan data tetap harus divalidasi oleh backend.

### 7.1 Authentication

| Method | Endpoint | Akses | Kegunaan |
|---|---|---|---|
| `POST` | `/auth/register` | Publik | Membuat akun ibu hamil |
| `POST` | `/auth/login` | Publik | Login dan memperoleh access token |
| `GET` | `/auth/me` | Auth | Mengambil identitas pengguna saat ini |
| `PATCH` | `/auth/me` | Auth | Memperbarui field profil yang diizinkan |
| `POST` | `/auth/change-password` | Auth | Mengganti password dengan verifikasi password lama |

Jangan sediakan endpoint registrasi publik yang memungkinkan pengguna memilih role tenaga kesehatan atau admin. Akun staf dibuat/diaktifkan melalui proses administrasi yang berwenang.

### 7.2 Profil dan perjalanan kehamilan

| Method | Endpoint | Akses | Kegunaan |
|---|---|---|---|
| `GET` | `/pregnancy/profile` | Ibu hamil | Melihat profil kehamilan sendiri |
| `PUT` | `/pregnancy/profile` | Ibu hamil | Membuat/memperbarui profil kehamilan sendiri |
| `GET` | `/pregnancy/timeline` | Ibu hamil, staf berwenang | Melihat timeline dari data yang tersedia |
| `GET` | `/pregnancy/journals` | Pemilik/staf berwenang | Daftar jurnal dengan pagination/filter tanggal |
| `POST` | `/pregnancy/journals` | Ibu hamil | Membuat jurnal |
| `GET` | `/pregnancy/journals/:id` | Pemilik/staf berwenang | Detail jurnal sesuai izin |
| `PATCH` | `/pregnancy/journals/:id` | Pemilik, sesuai aturan | Memperbarui jurnal yang diizinkan |
| `DELETE` | `/pregnancy/journals/:id` | Pemilik, sesuai kebijakan | Menghapus jurnal sendiri jika kebijakan retensi mengizinkan |

### 7.3 Riwayat pemeriksaan dan vaksinasi

| Method | Endpoint | Akses | Kegunaan |
|---|---|---|---|
| `GET` | `/medical-records` | Pasien/staf berwenang | Daftar riwayat yang dapat diakses |
| `POST` | `/medical-records` | Staf berwenang | Mencatat hasil pemeriksaan |
| `GET` | `/medical-records/:id` | Pasien/staf berwenang | Detail catatan sesuai izin |
| `PATCH` | `/medical-records/:id` | Staf berwenang | Memperbarui catatan sesuai audit |
| `GET` | `/vaccinations` | Pasien/staf berwenang | Daftar vaksinasi |
| `POST` | `/vaccinations` | Staf berwenang atau sesuai kebijakan | Mencatat rencana/status vaksinasi |
| `PATCH` | `/vaccinations/:id` | Staf berwenang | Memperbarui jadwal/status |
| `DELETE` | `/vaccinations/:id` | Admin/staf berwenang | Menghapus data sesuai kebijakan |

### 7.4 Jadwal ANC dan reminder

| Method | Endpoint | Akses | Kegunaan |
|---|---|---|---|
| `GET` | `/anc-appointments` | Pasien/staf berwenang | Daftar jadwal dengan filter tanggal/status |
| `POST` | `/anc-appointments` | Staf berwenang | Membuat jadwal pemeriksaan |
| `GET` | `/anc-appointments/:id` | Pasien/staf berwenang | Detail jadwal |
| `PATCH` | `/anc-appointments/:id` | Staf berwenang | Mengubah jadwal atau status |
| `POST` | `/anc-appointments/:id/cancel` | Pasien pemilik/staf berwenang | Membatalkan jadwal sesuai aturan |
| `POST` | `/anc-appointments/:id/reschedule` | Pasien pemilik/staf berwenang | Mengajukan atau menerapkan perubahan jadwal sesuai alur |
| `GET` | `/notifications` | Pemilik/staf berwenang | Melihat status pengingat yang diizinkan |
| `POST` | `/notifications/:id/retry` | Admin/staf berwenang | Mengulang notifikasi gagal dengan pembatasan |

Ketika jadwal diubah atau dibatalkan, reminder lama yang belum dikirim harus diperbarui atau dibatalkan. Pengiriman ulang harus idempotent dan dibatasi agar tidak menimbulkan spam.

### 7.5 Maternal Education Center

| Method | Endpoint | Akses | Kegunaan |
|---|---|---|---|
| `GET` | `/education` | Publik/akun sesuai kebijakan | Daftar konten `published` |
| `GET` | `/education/:slug` | Publik/akun sesuai kebijakan | Detail materi terbit |
| `POST` | `/education` | `CONTENT_EDITOR` | Membuat draf |
| `PATCH` | `/education/:id` | `CONTENT_EDITOR` | Memperbarui draf |
| `POST` | `/education/:id/submit-review` | `CONTENT_EDITOR` | Mengirim konten untuk ditinjau |
| `POST` | `/education/:id/approve` | `CLINICAL_REVIEWER` | Menyetujui konten |
| `POST` | `/education/:id/reject` | `CLINICAL_REVIEWER` | Menolak konten dan memberi catatan |
| `POST` | `/education/:id/publish` | Role berwenang | Menerbitkan konten yang telah disetujui |
| `POST` | `/education/:id/archive` | Role berwenang | Mengarsipkan konten |

### 7.6 Hospital Service

| Method | Endpoint | Akses | Kegunaan |
|---|---|---|---|
| `GET` | `/hospital-services` | Publik/akun sesuai kebijakan | Daftar layanan aktif |
| `GET` | `/hospital-services/:slug` | Publik/akun sesuai kebijakan | Detail layanan |
| `POST` | `/hospital-services` | `ADMIN` | Membuat layanan |
| `PATCH` | `/hospital-services/:id` | `ADMIN` | Memperbarui layanan |
| `DELETE` | `/hospital-services/:id` | `ADMIN` | Mengarsipkan/menghapus layanan sesuai kebijakan |

### 7.7 Healthcare Provider Dashboard

| Method | Endpoint | Akses | Kegunaan |
|---|---|---|---|
| `GET` | `/dashboard/summary` | `DOCTOR`, `MIDWIFE`, `ADMIN` sesuai cakupan | Ringkasan jumlah pasien/jadwal/status |
| `GET` | `/dashboard/appointments` | `DOCTOR`, `MIDWIFE`, `ADMIN` sesuai cakupan | Jadwal dalam rentang tanggal |
| `GET` | `/dashboard/missed-appointments` | `DOCTOR`, `MIDWIFE`, `ADMIN` sesuai cakupan | Daftar jadwal terlewat untuk ditinjau |
| `GET` | `/dashboard/patients` | Staf berwenang | Daftar pasien sesuai cakupan dan filter |
| `GET` | `/dashboard/patients/:patientId` | Staf yang ditugaskan | Ringkasan data pasien sesuai izin |
| `GET` | `/dashboard/audit-logs` | Admin berwenang | Audit log dengan filter terbatas |

Definisi jadwal terlewat harus konsisten, misalnya jadwal berstatus `scheduled`/`confirmed` yang waktu pemeriksaannya telah lewat dan belum diperbarui menjadi `completed`, `cancelled`, atau `rescheduled`. Jangan mengubah status klinis pasien hanya berdasarkan aturan ini.

### 7.8 Health check

| Method | Endpoint | Akses | Kegunaan |
|---|---|---|---|
| `GET` | `/health` | Publik atau internal | Memeriksa status aplikasi |
| `GET` | `/health/ready` | Internal | Memeriksa kesiapan aplikasi dan koneksi database |

Health endpoint tidak boleh membocorkan connection string, konfigurasi, atau detail sensitif.

---

## 8. Contoh Kontrak API

### 8.1 Login

**Request — `POST /api/v1/auth/login`**

```json
{
  "email": "ibu@example.com",
  "password": "contoh-password"
}
```

**Response — `200 OK`**

```json
{
  "success": true,
  "message": "Login berhasil",
  "data": {
    "accessToken": "<jwt-access-token>",
    "tokenType": "Bearer",
    "expiresIn": 3600,
    "user": {
      "id": "672000000000000000000001",
      "fullName": "Ibu Contoh",
      "role": "PREGNANT_MOTHER"
    }
  }
}
```

Contoh di atas hanya ilustrasi kontrak, bukan kredensial atau data pasien nyata. Implementasi harus mengembalikan token dengan masa berlaku yang dikonfigurasi.

### 8.2 Membuat jurnal kehamilan

**Request — `POST /api/v1/pregnancy/journals`**

```json
{
  "entryDate": "2026-11-02T00:00:00.000Z",
  "mood": "baik",
  "symptoms": ["mual ringan"],
  "notes": "Contoh catatan harian"
}
```

**Response — `201 Created`**

```json
{
  "success": true,
  "message": "Jurnal kehamilan berhasil dibuat",
  "data": {
    "id": "672000000000000000000002",
    "entryDate": "2026-11-02T00:00:00.000Z",
    "mood": "baik",
    "symptoms": ["mual ringan"],
    "notes": "Contoh catatan harian",
    "createdAt": "2026-11-02T03:00:00.000Z"
  }
}
```

Server mengambil `patientId` dari pengguna yang terautentikasi, bukan dari request body.

### 8.3 Membuat jadwal ANC

**Request — `POST /api/v1/anc-appointments`**

```json
{
  "patientId": "672000000000000000000001",
  "providerId": "672000000000000000000010",
  "facilityId": "672000000000000000000020",
  "scheduledAt": "2026-11-10T02:00:00.000Z",
  "visitType": "ANC",
  "reminder": {
    "enabled": true,
    "minutesBefore": 1440,
    "channel": "whatsapp"
  }
}
```

**Response — `201 Created`**

```json
{
  "success": true,
  "message": "Jadwal ANC berhasil dibuat",
  "data": {
    "id": "672000000000000000000030",
    "patientId": "672000000000000000000001",
    "providerId": "672000000000000000000010",
    "facilityId": "672000000000000000000020",
    "scheduledAt": "2026-11-10T02:00:00.000Z",
    "status": "scheduled",
    "reminderStatus": "pending"
  }
}
```

Payload dan response ini adalah contoh rancangan. Endpoint final perlu memvalidasi cakupan akses, ketersediaan jadwal, format tanggal, kanal yang didukung, dan aturan reminder. Untuk integrasi nyata, `reminderStatus` mencerminkan status sistem, bukan jaminan pesan sudah terkirim.

---

## 9. Dokumentasi Swagger / OpenAPI

Swagger wajib disiapkan sebagai bagian dari backend.

### 9.1 URL dokumentasi

- UI Swagger lokal: `http://localhost:3000/docs`
- Dokumen OpenAPI JSON: `http://localhost:3000/docs-json`
- API base path: `/api/v1`

Pada production, akses dokumentasi dapat dibatasi atau dinonaktifkan sesuai kebijakan deployment. Jangan memasukkan secret atau contoh data pasien nyata dalam dokumentasi.

### 9.2 Persyaratan Swagger

- Set title, deskripsi, dan versi API.
- Gunakan tag per modul: Auth, Users, Pregnancy, Medical Records, Vaccinations, ANC Appointments, Notifications, Education, Hospital Services, Dashboard, Health.
- Dokumentasikan request body dan response DTO.
- Dokumentasikan status HTTP dan skenario error.
- Gunakan `@ApiBearerAuth()` pada endpoint yang membutuhkan JWT.
- Gunakan `@ApiTags()`, `@ApiOperation()`, `@ApiResponse()`, `@ApiParam()`, dan `@ApiQuery()` yang relevan.
- Definisikan bearer authentication scheme.
- Sertakan contoh payload yang sintetis.
- Dokumentasikan pagination, filter, role, dan batasan akses.
- Dokumentasi harus mengikuti implementasi aktual; jangan mendokumentasikan endpoint yang belum dibuat seolah-olah sudah tersedia.

### 9.3 Contoh konfigurasi Swagger di `main.ts`

```typescript
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('MOMENT AI API')
    .setDescription(
      'REST API untuk pendampingan kesehatan maternal MOMENT AI. ' +
        'Sistem ini mendukung layanan dan administrasi maternal, bukan pengganti keputusan klinis.',
    )
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document, {
    jsonDocumentUrl: 'docs-json',
  });

  await app.listen(process.env.PORT ?? 3000);
}

bootstrap();
```

Catatan: dengan `setGlobalPrefix('api')` dan URI versioning, route versi pertama menjadi `/api/v1/...`, sementara Swagger UI berada di `/docs`. Jika versi NestJS yang digunakan memerlukan penyesuaian konfigurasi, pastikan hasil akhirnya sesuai URL yang tercantum di atas.

---

## 10. Struktur Folder yang Disarankan

```text
moment-ai-backend/
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── common/
│   │   ├── decorators/
│   │   ├── filters/
│   │   ├── guards/
│   │   ├── interceptors/
│   │   ├── pipes/
│   │   ├── constants/
│   │   └── utils/
│   ├── config/
│   │   └── configuration.ts
│   ├── database/
│   │   └── database.module.ts
│   ├── auth/
│   │   ├── auth.module.ts
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   ├── strategies/
│   │   └── dto/
│   ├── users/
│   ├── pregnancy/
│   │   ├── pregnancy.module.ts
│   │   ├── profile/
│   │   ├── journals/
│   │   └── timeline/
│   ├── medical-records/
│   ├── vaccinations/
│   ├── anc-appointments/
│   ├── notifications/
│   │   ├── providers/
│   │   └── templates/
│   ├── education/
│   ├── hospital-services/
│   ├── dashboard/
│   ├── audit-logs/
│   └── health/
├── test/
│   ├── app.e2e-spec.ts
│   └── ...
├── .env.example
├── .gitignore
├── eslint.config.mjs
├── nest-cli.json
├── package.json
├── tsconfig.json
└── README.md
```

Setiap modul data minimal memiliki controller, service, DTO, schema/model, dan test yang relevan. Struktur dapat disederhanakan saat hackathon, tetapi pemisahan tanggung jawab tetap dijaga.

---

## 11. Environment Variables

Sediakan `.env.example` tanpa secret sungguhan.

```dotenv
NODE_ENV=development
PORT=3000
APP_BASE_URL=http://localhost:3000
FRONTEND_ORIGINS=http://localhost:5173,http://localhost:3001

MONGODB_URI=mongodb+srv://<username>:<password>@<cluster-url>/<database>?retryWrites=true&w=majority

JWT_ACCESS_SECRET=replace-with-a-long-random-secret
JWT_ACCESS_EXPIRES_IN=1h
PASSWORD_HASH_ROUNDS=12

REMINDER_CRON_ENABLED=false
DEFAULT_TIMEZONE=Asia/Jakarta

WHATSAPP_PROVIDER=mock
WHATSAPP_API_URL=
WHATSAPP_API_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=

RATE_LIMIT_TTL=60000
RATE_LIMIT_LIMIT=100
```

Catatan:
- Gunakan secret yang kuat dan berbeda per environment.
- Jangan commit `.env`.
- Jangan mencatat connection string, token, password, atau data pasien ke log.
- Nilai konfigurasi final harus disesuaikan dengan provider notifikasi dan strategi autentikasi yang dipilih.
- Untuk production, pertimbangkan secret manager dari platform deployment.

---

## 12. Keamanan, Privasi, dan Keselamatan

Karena sistem memproses data pribadi dan kesehatan, persyaratan berikut bersifat wajib:

1. **Authentication:** hash password, verifikasi token, dan gunakan masa berlaku token yang sesuai.
2. **Authorization:** RBAC ditambah pemeriksaan kepemilikan resource, penugasan pasien, dan cakupan fasilitas pada setiap request.
3. **Validation:** aktifkan `ValidationPipe` dengan `whitelist`, `forbidNonWhitelisted`, dan `transform`; batasi panjang string dan ukuran payload.
4. **Database:** gunakan MongoDB Atlas dengan akses jaringan dan database user berhak minimum; gunakan TLS.
5. **Secrets:** simpan secret hanya di environment/secret manager.
6. **Rate limiting:** batasi percobaan login, registrasi, dan endpoint yang rawan penyalahgunaan.
7. **CORS:** izinkan hanya origin frontend yang disetujui; jangan gunakan wildcard dengan credential.
8. **HTTP security:** gunakan Helmet dan konfigurasi header yang sesuai.
9. **Audit:** catat akses/perubahan sensitif tanpa merekam token atau isi data kesehatan secara berlebihan.
10. **Data minimization:** kumpulkan data minimum sesuai kebutuhan fitur dan dokumentasikan tujuan pemrosesannya.
11. **Consent:** simpan status dan versi persetujuan yang relevan; sediakan alur perubahan/pencabutan sesuai kebijakan yang berlaku.
12. **Error handling:** jangan membocorkan stack trace, query database, atau keberadaan akun secara berlebihan.
13. **Notification privacy:** jangan mengirim diagnosis, hasil pemeriksaan, atau detail sensitif melalui pesan reminder standar.
14. **AI safety:** jika chatbot AI ditambahkan, jawaban harus dibatasi pada sumber terpercaya dan tidak boleh menggantikan diagnosis. Pertanyaan/tanda bahaya harus diarahkan ke tenaga kesehatan atau layanan darurat sesuai protokol yang divalidasi.
15. **Clinical validation:** materi edukasi dan aturan tanda bahaya wajib ditinjau tenaga kesehatan sebelum dipublikasikan.
16. **Data dummy:** gunakan data sintetis untuk development, testing, dan demo. Data nyata hanya boleh digunakan setelah persetujuan, dasar pemrosesan, dan perlindungan yang sesuai tersedia.

Persyaratan ini perlu disesuaikan lebih lanjut dengan kebijakan rumah sakit dan ketentuan perlindungan data yang berlaku sebelum penggunaan klinis.

---

## 13. Testing Requirements

### 13.1 Unit testing

Minimal uji:
- Validasi DTO.
- Aturan role dan kepemilikan data.
- Pembuatan dan perubahan jadwal ANC.
- Perhitungan jadwal terlewat.
- Pembatalan/reschedule dan perubahan reminder.
- Alur status publikasi edukasi.
- Penanganan kegagalan provider notifikasi.
- Sanitasi error dan audit log.

### 13.2 Integration testing

Uji dengan database test terpisah:
- Registrasi dan login.
- CRUD jurnal kehamilan.
- CRUD jadwal ANC.
- Pembuatan notifikasi dan idempotensi.
- Akses dashboard dengan role dan cakupan pasien berbeda.
- Alur draf → review → publish konten.
- Penanganan resource yang tidak ditemukan dan akses yang ditolak.

### 13.3 End-to-end testing

- Endpoint berjalan pada prefix `/api/v1`.
- Endpoint terlindungi menolak request tanpa token valid.
- Ibu hamil tidak dapat membaca atau mengubah data pasien lain.
- Tenaga kesehatan tidak dapat mengakses pasien di luar cakupannya.
- Response mengikuti format API yang ditentukan.
- Dokumentasi Swagger dapat dibuka dan memuat endpoint yang sudah diimplementasikan.
- Reminder tidak dikirim dua kali untuk idempotency key yang sama.
- Kegagalan provider tidak menyebabkan jadwal ANC hilang atau berubah tanpa sengaja.

---

## 14. Kriteria Penerimaan MVP

MVP backend dinyatakan memenuhi kebutuhan awal apabila:

- [ ] NestJS dan TypeScript berjalan dengan konfigurasi yang konsisten.
- [ ] Aplikasi terhubung ke MongoDB Atlas menggunakan environment variable.
- [ ] Autentikasi JWT dan RBAC berjalan.
- [ ] Profil kehamilan dan jurnal kehamilan dapat dibuat, dibaca, diperbarui, dan dibatasi berdasarkan pemilik.
- [ ] Riwayat pemeriksaan dan status vaksinasi dapat dicatat sesuai role.
- [ ] Jadwal ANC mendukung pembuatan, pembaruan status, pembatalan, dan reschedule.
- [ ] Sistem memiliki struktur reminder dan pencatatan status pengiriman.
- [ ] Konten edukasi hanya tampil kepada pengguna setelah dipublikasikan melalui alur review.
- [ ] Informasi layanan rumah sakit dapat dibaca pengguna dan dikelola admin.
- [ ] Dashboard menampilkan ringkasan jadwal/status dan daftar jadwal terlewat berdasarkan cakupan akses.
- [ ] Swagger/OpenAPI tersedia pada `/docs`.
- [ ] Validasi input, error handling, rate limiting, CORS, dan logging dasar diterapkan.
- [ ] Unit test dan integration/e2e test untuk alur kritis tersedia.
- [ ] MVP dapat diuji menggunakan data sintetis tanpa integrasi SIMRS.
- [ ] Tidak ada fitur yang mengklaim menggantikan diagnosis atau keputusan klinis tenaga kesehatan.

---

## 15. Tahapan Implementasi yang Disarankan

### Tahap 1 — Fondasi
1. Inisialisasi NestJS dan konfigurasi TypeScript.
2. Konfigurasi MongoDB Atlas dan Mongoose.
3. Konfigurasi environment validation, global prefix, validation pipe, error filter, CORS, Helmet, dan rate limiting.
4. Setup Swagger.
5. Implementasi autentikasi dan RBAC.

### Tahap 2 — Fitur inti ibu hamil
1. Profil pengguna dan profil kehamilan.
2. Jurnal kehamilan.
3. Riwayat pemeriksaan dan vaksinasi.
4. Jadwal ANC, perubahan status, pembatalan, dan reschedule.

### Tahap 3 — Reminder dan konten
1. Notification module dan adapter mock.
2. Scheduler untuk menemukan reminder yang jatuh tempo.
3. Integrasi provider WhatsApp/SMS setelah kredensial dan kebutuhannya jelas.
4. Maternal Education Center dengan workflow review.
5. Hospital Service.

### Tahap 4 — Dashboard dan pengujian
1. Endpoint ringkasan dashboard.
2. Daftar jadwal dan jadwal terlewat.
3. Audit log untuk aksi sensitif.
4. Unit, integration, dan e2e tests.
5. Uji alur dari prototype frontend ke API.
6. Persiapan deployment dan konfigurasi production.

---

## 16. Referensi dan Asumsi

### Sumber dari proposal MOMENT AI
- Nama produk: MOMENT AI (*Maternal Journey Assistant*).
- Fitur utama: Pregnancy Journey Tracker, Smart ANC Reminder, Maternal Education Center, Hospital Service, dan Healthcare Provider Dashboard.
- Materi edukasi mengacu pada Buku KIA Kementerian Kesehatan RI dan perlu validasi tenaga kesehatan.
- MVP dapat menggunakan data simulasi.
- Integrasi penuh SIMRS belum tersedia dan bukan prasyarat tahap awal.
- Sistem mendukung pelayanan dan administrasi, bukan menggantikan keputusan klinis tenaga kesehatan.

### Referensi prototype
- [MOMENT AI – UI/UX Dashboard untuk Tenaga Kesehatan](https://moment-ai-nakes.vercel.app/)

Prototype digunakan sebagai acuan alur dashboard. Karena struktur internal frontend dan kontrak data aktual tidak disertakan dalam proposal, endpoint dan model data dalam dokumen ini merupakan rancangan backend yang perlu dicocokkan kembali dengan layar dan user flow final.

### Asumsi teknis yang masih perlu dikonfirmasi
- Mekanisme login final: email/password, nomor telepon/OTP, atau kombinasi.
- Provider notifikasi WhatsApp/SMS yang akan digunakan.
- Definisi relasi fasilitas kesehatan, dokter/bidan, dan pasien.
- Field final untuk rekam medis dan jurnal kehamilan.
- Aturan retensi, koreksi, dan penghapusan data kesehatan.
- Apakah fitur chatbot AI masuk MVP atau fase lanjutan.
- Apakah dashboard memiliki role khusus manajemen rumah sakit.
- Konfigurasi deployment, domain API, dan kebijakan akses Swagger production.

---

**Catatan implementasi:** Gunakan dokumen ini sebagai spesifikasi awal untuk membangun backend. Sebelum implementasi final, sinkronkan kontrak endpoint dan field DTO dengan frontend prototype serta validasikan workflow medis dan kebijakan akses bersama pihak rumah sakit.
