# AbsenQR — Sistem Absensi Digital Berbasis QR Code

Aplikasi absensi siswa berbasis QR Code yang dapat diakses melalui browser HP Android.

## 🏗️ Struktur Project

```
MBG NEWGEN/
├── backend/     # NestJS + Prisma + PostgreSQL
└── frontend/    # React + Vite + TypeScript
```

---

## ⚙️ Prasyarat

- Node.js >= 18
- npm >= 9
- PostgreSQL (lokal atau cloud)
- DBeaver (opsional, untuk manajemen database)

---

## 🗄️ Setup Database (PostgreSQL)

### 1. Buat database

Buka DBeaver atau `psql` dan jalankan:

```sql
CREATE DATABASE mbg_attendance;
```

### 2. Konfigurasi koneksi

Salin dan edit file `.env`:

```bash
cd backend
cp .env.example .env
```

Edit `backend/.env`:

```env
DATABASE_URL="postgresql://USERNAME:PASSWORD@localhost:5432/mbg_attendance"
JWT_SECRET="ganti-dengan-secret-yang-aman"
JWT_EXPIRES_IN="24h"
PORT=3000
FRONTEND_URL="http://localhost:5173"
BACKEND_URL="http://localhost:3000"
```

---

## 🚀 Setup Backend

```bash
cd backend

# Install dependencies (jika belum)
npm install

# Generate Prisma client
npx prisma generate

# Jalankan migration
npx prisma migrate dev --name init

# Seed data awal (akun petugas + siswa contoh)
npx prisma db seed

# Jalankan server development
npm run start:dev
```

Backend akan berjalan di: `http://localhost:3000`

---

## 🎨 Setup Frontend

```bash
cd frontend

# Install dependencies (jika belum)
npm install

# Konfigurasi .env
cp .env.example .env
# Edit VITE_API_URL jika backend bukan di localhost:3000

# Jalankan dev server
npm run dev
```

Frontend akan berjalan di: `http://localhost:5173`

---

## 👤 Akun Default (Seed Data)

| Role    | Username   | Password    |
|---------|------------|-------------|
| Petugas | petugas01  | petugas123  |
| Admin   | admin      | admin123    |

> **Penting:** Ganti password di production!

---

## 📡 API Endpoints

Base URL: `http://localhost:3000/api/v1`

### Auth

| Method | Endpoint       | Auth | Deskripsi        |
|--------|---------------|------|------------------|
| POST   | /auth/login   | ❌   | Login petugas    |
| GET    | /auth/me      | ✅   | Info petugas login |

#### Contoh Login:
```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "petugas01", "password": "petugas123"}'
```

### Students

| Method | Endpoint              | Auth | Deskripsi             |
|--------|----------------------|------|-----------------------|
| GET    | /students            | ✅   | Daftar siswa (paged)  |
| POST   | /students            | ✅   | Tambah siswa baru     |
| GET    | /students/:id        | ✅   | Detail siswa          |
| PATCH  | /students/:id        | ✅   | Update data siswa     |
| POST   | /students/:id/photo  | ✅   | Upload foto siswa     |
| GET    | /students/:id/qr     | ✅   | Generate QR Code      |

#### Contoh Tambah Siswa:
```bash
curl -X POST http://localhost:3000/api/v1/students \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "nisn": "0012345678",
    "name": "Nama Siswa",
    "schoolName": "SMA Negeri 1",
    "gender": "LAKI_LAKI",
    "foodRestrictions": null
  }'
```

### Attendance

| Method | Endpoint          | Auth | Deskripsi                |
|--------|------------------|------|--------------------------|
| POST   | /attendance/scan  | ✅   | Scan QR dan catat absensi |
| GET    | /attendance       | ✅   | Rekap absensi (filter)   |
| GET    | /attendance/:id   | ✅   | Detail satu record       |

#### Contoh Scan QR:
```bash
curl -X POST http://localhost:3000/api/v1/attendance/scan \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"qrToken": "uuid-token-dari-qr-siswa"}'
```

#### Query Rekap:
```
GET /attendance?date=2026-10-11&search=budi&page=1&limit=20
```

---

## 📱 Penggunaan di HP Android

1. Pastikan HP dan PC dalam jaringan WiFi yang sama
2. Jalankan backend dengan `npm run start:dev`
3. Jalankan frontend dengan `npm run dev -- --host`
4. Buka browser Android → ketik IP PC, misal: `http://192.168.1.10:5173`
5. Login dan mulai scan QR

> **Catatan:** Kamera QR hanya bisa diakses di HTTPS atau localhost. Untuk testing lokal lewat IP, gunakan mkcert atau ngrok untuk HTTPS.

---

## 🔐 Keamanan

- Password disimpan menggunakan **bcrypt** (cost factor 10)
- Autentikasi menggunakan **JWT** (expired 24 jam)
- QR Code hanya berisi token acak, bukan data pribadi
- Semua endpoint sensitif dilindungi JWT Guard
- CORS hanya mengizinkan origin frontend
- Pencegahan duplikasi absensi via DB unique constraint

---

## 🛠️ Perintah Berguna

```bash
# Backend
npx prisma studio           # Buka UI database
npx prisma migrate reset    # Reset database (hapus semua data!)
npx prisma db seed          # Seed ulang data
npm run start:dev           # Development dengan hot reload

# Frontend
npm run dev -- --host       # Expose ke jaringan lokal (untuk HP)
npm run build               # Build production
```

---

## 📂 File yang Dibuat/Dimodifikasi

### Backend (`backend/`)
- `prisma/schema.prisma` — Database schema (Student, Staff, Attendance)
- `prisma/seed.ts` — Data sintetis untuk testing
- `src/main.ts` — Entry point dengan CORS, prefix, static files
- `src/auth/` — JWT authentication module
- `src/students/` — Student CRUD + QR generation
- `src/attendance/` — Scan QR + rekap absensi
- `src/prisma/` — Prisma service

### Frontend (`frontend/`)
- `src/api/` — Axios API clients (auth, students, attendance)
- `src/context/AuthContext.tsx` — Auth state management
- `src/pages/LoginPage.tsx` — Halaman login
- `src/pages/ScanPage.tsx` — Halaman scan QR
- `src/pages/AttendancePage.tsx` — Halaman rekap absensi
- `src/components/StudentCard.tsx` — Komponen kartu siswa
- `src/components/BottomNav.tsx` — Navigasi bawah
- `src/index.css` — Design system global

---

## 🐛 Troubleshooting

| Masalah | Solusi |
|---------|--------|
| Kamera tidak muncul di HP | Gunakan HTTPS (ngrok/mkcert) atau akses via `localhost` |
| Koneksi ke backend gagal | Periksa FRONTEND_URL di `.env` backend dan `VITE_API_URL` di frontend |
| Migration gagal | Pastikan PostgreSQL berjalan dan `DATABASE_URL` benar |
| Seed gagal | Jalankan `npx prisma migrate reset` lalu `npx prisma db seed` |
