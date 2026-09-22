# NegmAlMashrek QR Attendance · Secured · Frontend-only ⚡️

A modern, mobile-first **React + Firebase** web app for taking attendance
with QR codes — import a list of names from Excel, generate a unique QR
code per person, scan with any phone's camera, and export the attendance
log back to Excel.

> No Node/Express backend. Security is enforced entirely server-side by
> **Firebase Auth + Firestore Rules** (and optional **App Check**).

![tech](https://img.shields.io/badge/React-18-61dafb?logo=react&logoColor=white)
![tech](https://img.shields.io/badge/Vite-5-646cff?logo=vite&logoColor=white)
![tech](https://img.shields.io/badge/Firebase-10-ffca28?logo=firebase&logoColor=black)
![tech](https://img.shields.io/badge/Tailwind-3-38bdf8?logo=tailwindcss&logoColor=white)
![license](https://img.shields.io/badge/License-MIT-brightgreen)

---

## ✨ Features

- 📤 **Import names** from Excel (`.xlsx` / `.xls` / `.csv`) — drag & drop
- 📥 **Download a clean Excel template** to fill in
- 🪪 **Auto-generate a unique QR code per person**, save as PNG, print all
- ➕ **Add new people on the fly** — instantly produces a fresh QR
- 🗑 **In-app confirmation dialogs** (no ugly browser popups)
- 📷 **Live webcam QR scanner** records attendance in real-time
- 🔒 **Server-side duplicate prevention** — same person can't be scanned
  twice the same day, even with multiple scanners running concurrently
- 📊 **Real-time records view** with date filters (Today / Yesterday / pick a date)
- 📥 **Export attendance** to a styled `.xlsx`
- ☁️ **Multi-device, multi-scanner real-time sync** via Firestore
- � **Admin / Scanner role separation** enforced by Firestore rules
- 📱 **Mobile-first responsive UI** with bottom tab bar
- 🛡 **Hardened security**: field validation, immutable records,
  deterministic doc IDs, ErrorBoundary, length limits

---

## 🛠 Tech Stack

| | |
|---|---|
| **Frontend** | React 18, Vite 5, Tailwind CSS 3, React Router 6 |
| **Backend** | Firebase Firestore, Auth (Email/Password + Anonymous), App Check (optional) |
| **QR** | `qrcode.react` (generate), `html5-qrcode` (scan) |
| **Excel** | `xlsx` (SheetJS) |
| **Icons** | `lucide-react` |
| **Hosting** | Google Cloud Run (workflow included) |

---

## 👥 Roles

| Role | Sign-in | Can do |
|---|---|---|
| **Admin** | Email/Password (single hardcoded email) | Everything (import, add, delete, export, clear) |
| **Scanner** | Anonymous (auto, no UI) | Read people, log new attendance |
| **Public** | — | Nothing (Firestore rules block all unauth requests) |

The admin email is set in **two** places — both must match:
- `src/firebase.js` → `ADMIN_EMAIL`
- `firestore.rules` → `request.auth.token.email == '...'`

---

## 🚀 Quick Start (local dev)

```bash
git clone https://github.com/<you>/qr-attendance.git
cd qr-attendance
npm install
npm run dev
```

Open <http://localhost:5173>.

The app starts on `/scan` (auto-anonymous sign-in for scanners). Click
**🔒 Admin login** in the top right and enter your admin credentials to
access **People** and **Records**.

> ⚠️ For **mobile camera access**, the page must be served on **HTTPS**
> or `localhost` (browser secure-context requirement).

---

## 🔥 Firebase one-time setup

1. **Create a Firebase project** at <https://console.firebase.google.com>
2. **Web app** — Project settings → "Your apps" → ⚙️ → Web → register →
   copy the config into `.env` for local dev and GitHub Variables for deployment.
3. **Authentication → Sign-in method:**
   - Enable **Email/Password**
   - Enable **Anonymous**
4. **Authentication → Users → Add user:**
   - Email: `admin@negmalmashrek.com` *(or any email — keep it in sync with the two files above)*
   - Password: *(your choice — keep it safe)*
5. **Firestore Database → Rules** → paste contents of `firestore.rules`
   → click **Publish**.
6. *(Optional but recommended)* **App Check → register your web app
   with reCAPTCHA v3**, then paste the SITE key into a `.env` file:

   ```
   cp .env.example .env
   # then edit .env and paste your site key
   ```

---

## 📦 Build for production

```bash
npm run build      # outputs ./build
npm run preview    # serve ./build locally
```

The build is split into vendor chunks (`react`, `firebase`, `qr`, `xlsx`,
`icons`) so the gzipped main bundle stays small.

---

## ☁️ Deploy to Google Cloud Run

This repo is configured to build a static Vite bundle, package it with nginx,
push the image to Artifact Registry, and deploy it to Cloud Run from
`.github/workflows/google-cloud-run.yml`.

**One-time setup:**

1. Push this repo to GitHub.
2. In Google Cloud, create or choose:
   - A Cloud Run service name
   - An Artifact Registry Docker repository
   - A service account with permission to push images and deploy Cloud Run
3. Add the required GitHub Actions Variables:
   - `GCP_PROJECT_ID`
   - `GCP_REGION`
   - `CLOUD_RUN_SERVICE`
   - `GAR_LOCATION`
   - `GAR_REPOSITORY`
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`
   - `VITE_ADMIN_EMAIL`
   - `VITE_RECAPTCHA_V3_SITE_KEY` *(optional)*
4. Add the required keyless Google Cloud auth variables:
   - `GCP_WORKLOAD_IDENTITY_PROVIDER`
   - `GCP_SERVICE_ACCOUNT`
5. Every push to `main` builds + deploys automatically. Your URL appears
   in the workflow logs and on the Cloud Run service page.

The included nginx config sets SPA fallback to `index.html`, security headers,
camera permission, and long cache headers for hashed assets.

> 🌐 After deployment, add your Cloud Run hostname to **Firebase Auth →
> Settings → Authorized domains**, otherwise sign-in will fail in production.

---

## 📁 Project structure

```
qrcode/
├── .github/workflows/google-cloud-run.yml
├── src/
│   ├── firebase.js                 Firebase init + ADMIN_EMAIL + App Check
│   ├── context/AuthContext.jsx     Auth state, anonymous + admin sign-in
│   ├── components/
│   │   ├── ConfirmDialog.jsx       Reusable in-app confirm modal
│   │   ├── ErrorBoundary.jsx       Catches React render errors
│   │   ├── Navbar.jsx              Role-aware navigation (top + bottom tab bar)
│   │   ├── QRCard.jsx              Person card + QR canvas + download
│   │   └── RequireAdmin.jsx        Route guard
│   ├── pages/
│   │   ├── LoginPage.jsx
│   │   ├── PeoplePage.jsx          (admin only)
│   │   ├── ScanPage.jsx
│   │   └── RecordsPage.jsx         (admin only)
│   ├── services/firestoreService.js
│   ├── utils/
│   │   ├── excel.js                import / export / template
│   │   └── dateUtils.js
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css
├── firestore.rules                 Server-side security
├── Dockerfile
├── cloudrun.nginx.conf
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── index.html
├── .env.example
├── .gitignore
└── package.json
```

---

## 🗃 Firestore data model

```
/people/{id}      → { name, createdAt }
/attendance/{id}  → { personId, name, date: "YYYY-MM-DD",
                       time: "HH:MM:SS", timestamp }
```

Attendance documents use a **deterministic ID**: `${personId}_${date}`.
This makes "one check-in per person per day" enforced atomically by
Firestore — no race condition is possible even when multiple scanners
scan the same person at the same instant.

---

## 🛡 Security model (enforced by `firestore.rules`)

- `/people` — read: any signed-in user · write/delete: **admin only**
- `/attendance` — read: any signed-in user · create: any signed-in user
  (with validated payload + `personId` must exist in `/people` + doc ID
  matches `personId_date`) · update: **never** · delete: **admin only**
- All field types, lengths, and formats are validated server-side.

The Firebase `apiKey` in `firebase.js` is **safe** to commit — it
identifies the project, not authorize access. Real security comes from
the Firestore rules.

---

## 🧪 Try the full flow

1. Login as admin → **People** tab
2. Click **Template** → fill 3 names in the downloaded `.xlsx`
3. Drop the file in the upload zone → 3 people added with QR codes
4. Open the **Scan** tab on your phone (after deploying to HTTPS)
5. Point the camera at one of the QR codes → ✅ green check, audio beep
6. Scan the same QR again → ⚠️ "already checked in today"
7. Go to **Records** → see the live entry → **Export Excel**

---

## 📝 License

MIT — see [LICENSE](LICENSE).

---

## 🙋 Notes

- If you change `ADMIN_EMAIL`, **also update `firestore.rules` and re-publish.**
- The Firestore "missing or insufficient permissions" error usually
  means the published rules don't match the signed-in user's email.
- For production, enable App Check to block bots and ensure the dev
  debug token is **not** allowed in your production reCAPTCHA key.
