# AbsenQR on Supabase

This version runs the React app directly against Supabase. The `backend/` folder is retained only as a rollback path and is not deployed.

## 1. Create the database schema

In the Supabase dashboard, open **SQL Editor**, create a new query, paste the complete contents of:

`supabase/migrations/202611100001_initial.sql`

Run the query once. It creates the recipient tables, attendance table, staff profiles, row-level security policies, and the atomic QR scan function.

## 2. Create the first staff account

Open **Authentication → Users → Add user** and create:

- Email: `admin@absenqr.local`
- Password: choose a strong pilot password
- Auto confirm user: enabled

The app converts the username `admin` to that internal email automatically. The database trigger creates the matching staff profile.

To set the display name, run this in SQL Editor:

```sql
update public.staff_profiles
set name = 'Administrator'
where username = 'admin';
```

For another username such as `petugas01`, create `petugas01@absenqr.local` in Authentication.

Do not enable public sign-up. Staff accounts should be created by an administrator in the Supabase dashboard.

## 3. Configure the frontend

Copy `frontend/.env.example` to `frontend/.env` and fill in the project values from **Project Settings → API**:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
```

The publishable/anon key is intended for browser use. Never put the `service_role` key in the frontend or in Vercel.

## 4. Test locally

```powershell
cd frontend
npm run dev
```

Open `http://localhost:5173`, sign in with username `admin`, add one recipient, download their QR, and scan it once. Confirm the record appears under **Rekap**.

## 5. Deploy for Android

The simplest route is Vercel:

1. Push the repository to GitHub.
2. Import it at Vercel.
3. Set **Root Directory** to `frontend`.
4. Keep Framework Preset as **Vite**.
5. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` as environment variables.
6. Deploy.

`frontend/vercel.json` provides the SPA fallback required by React Router.

Open the resulting HTTPS URL in Android Chrome and allow camera access. Chrome can add the URL to the home screen as a shortcut.

## Important pilot notes

- The app requires internet access on the phone.
- Photos are intentionally not stored or displayed.
- Existing records in the laptop PostgreSQL database are not copied by this fresh setup.
- Supabase Auth stores staff passwords; the old backend password hashes are not reused.
- QR attendance insertion is performed by the database function and remains unique per recipient per WIB day.
