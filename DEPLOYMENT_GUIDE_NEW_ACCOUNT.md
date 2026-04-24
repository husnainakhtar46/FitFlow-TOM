# FitFlow TOM — New Account Deployment Guide
## Target: husnainakhtar0110@gmail.com | Firebase: fitflow-QMS

> **This guide deploys to a BRAND NEW Google Cloud account.**
> Follow every step in order. Do NOT skip any step.

---

## 📋 KEY DETAILS FOR THIS DEPLOYMENT

| Item | Value |
|---|---|
| Google Account | `husnainakhtar0110@gmail.com` |
| GCP Project ID | `fitflow-qms` *(you will create this)* |
| Firebase Project | `fitflow-QMS` |
| Cloud Run Service | `fitflow-backend` |
| Region | `us-central1` |
| GCS Media Bucket | `fitflow-media` |
| DB | Google Cloud SQL (PostgreSQL) — new |

---

## ⚙️ PHASE 0 — ONE-TIME SETUP (Prerequisites)

### Step 0.1 — Login to NEW Google Account

```powershell
# This will open a browser — sign in with husnainakhtar0110@gmail.com
gcloud auth login
```

### Step 0.2 — Verify you are logged into the correct account

```powershell
gcloud auth list
```
> ✅ You must see `husnainakhtar0110@gmail.com` marked as ACTIVE. If not, re-run Step 0.1.

### Step 0.3 — Create the GCP Project

```powershell
gcloud projects create fitflow-qms --name="FitFlow QMS"
```

### Step 0.4 — Set the project as default

```powershell
gcloud config set project fitflow-qms
```

### Step 0.5 — Verify correct project is active

```powershell
gcloud config get-value project
```
> ✅ Output must say: `fitflow-qms`

### Step 0.6 — Link Billing Account
> ⚠️ **REQUIRED:** Cloud Run, Cloud Build, and Cloud SQL will NOT work without billing enabled.
> 1. Go to: https://console.cloud.google.com/billing/projects
> 2. Sign in as `husnainakhtar0110@gmail.com`
> 3. Link a billing account to the `fitflow-qms` project.
> 4. Come back here and continue.

### Step 0.7 — Enable Required Google Cloud APIs

```powershell
gcloud services enable `
    run.googleapis.com `
    cloudbuild.googleapis.com `
    storage.googleapis.com `
    sqladmin.googleapis.com `
    cloudresourcemanager.googleapis.com `
    iam.googleapis.com
```
> ⏳ This takes 1-2 minutes. Wait for the command to finish.

---

## 🗄️ PHASE 1 — CREATE DATABASE (Google Cloud SQL)

We are moving away from Supabase and using a Google Cloud SQL PostgreSQL database.

### Step 1.1 — Create the Cloud SQL Instance

```powershell
gcloud sql instances create fitflow-db `
    --database-version=POSTGRES_15 `
    --tier=db-f1-micro `
    --region=us-central1 `
    --storage-size=10GB `
    --storage-auto-increase `
    --availability-type=ZONAL
```
> ⏳ This takes **5-10 minutes**. Wait until it says "Created".

### Step 1.2 — Create the Database

```powershell
gcloud sql databases create fitflow --instance=fitflow-db
```

### Step 1.3 — Set Password for the postgres User

```powershell
# Choose a STRONG password and save it somewhere safe
gcloud sql users set-password postgres `
    --instance=fitflow-db `
    --password=YOUR_STRONG_DB_PASSWORD_HERE
```
> ⚠️ **Replace `YOUR_STRONG_DB_PASSWORD_HERE` with your actual password.**
> Example of a strong password: `FitFlow@QMS2026!`
> Write this down — you will need it in later steps.

### Step 1.4 — Get the Database Connection Name (save this!)

```powershell
gcloud sql instances describe fitflow-db --format="value(connectionName)"
```
> ✅ Output will look like: `fitflow-qms:us-central1:fitflow-db`
> **Save this value** — you will need it in Step 3.

---

## 🔐 PHASE 2 — GENERATE SECRET KEY

We need a secure Django SECRET_KEY for production.

### Step 2.1 — Generate a random secret key

```powershell
# Run this in PowerShell to generate a secure key
$SECRET_KEY = -join ((65..90) + (97..122) + (48..57) + @(33,35,36,37,38,40,41,42,43,45,61,63,64,94,95) | Get-Random -Count 60 | ForEach-Object {[char]$_})
Write-Host "Your Secret Key: $SECRET_KEY"
```
> ✅ **Copy this key and save it.** You will need it in Step 3.

---

## 🚀 PHASE 3 — DEPLOY BACKEND (Google Cloud Run)

**Directory: Project Root**

### Step 3.1 — Navigate to project root

```powershell
cd "d:\Coding\Fit Flow - TOM"
```

### Step 3.2 — Confirm you are in the right folder

```powershell
Get-Location
```
> ✅ Must show: `d:\Coding\Fit Flow - TOM`

### Step 3.3 — Set variables (fill in YOUR values)

```powershell
# --- FILL IN YOUR VALUES HERE ---
$PROJECT_ID = "fitflow-qms-2026"
$DB_CONNECTION_NAME = "fitflow-qms-2026:us-central1:fitflow-db"   
$DB_PASSWORD = "Hus0110TOM"                  
$SECRET_KEY = 'JNHVr$WSedo=kiDG?@-9us(36K2Yf%!w01OjPhBIRAFC4ZUyxMncm*p&gq+z'
$FRONTEND_URL = "https://fitflow-qms.web.app"
```

### Step 3.4 — Create Artifact Registry & Build Image (Cloud Build)

Google Cloud has moved from Container Registry to Artifact Registry. Let's create the repository first:

```powershell
gcloud artifacts repositories create fitflow-repo `
    --repository-format=docker `
    --location=us-central1 `
    --description="Docker repository for FitFlow Backend"
```

Now build and submit the image:

```powershell
gcloud builds submit --tag us-central1-docker.pkg.dev/$PROJECT_ID/fitflow-repo/fitflow-backend
```
> ⏳ This takes **3-5 minutes**. Wait until it says "SUCCESS".

### Step 3.5 — Deploy the Backend to Cloud Run

```powershell
gcloud run deploy fitflow-backend `
    --image us-central1-docker.pkg.dev/$PROJECT_ID/fitflow-repo/fitflow-backend `
    --platform managed `
    --region us-central1 `
    --memory 1Gi `
    --allow-unauthenticated `
    --add-cloudsql-instances $DB_CONNECTION_NAME `
    --set-env-vars "DJANGO_SETTINGS_MODULE=config.settings_production" `
    --set-env-vars "SECRET_KEY=$SECRET_KEY" `
    --set-env-vars "DB_HOST=/cloudsql/$DB_CONNECTION_NAME" `
    --set-env-vars "DB_NAME=fitflow" `
    --set-env-vars "DB_USER=postgres" `
    --set-env-vars "DB_PASSWORD=$DB_PASSWORD" `
    --set-env-vars "DB_PORT=5432" `
    --set-env-vars "GCP_PROJECT_ID=$PROJECT_ID" `
    --set-env-vars "GCS_BUCKET_NAME=fitflow-media" `
    --set-env-vars "CORS_ALLOWED_ORIGINS=$FRONTEND_URL" `
    --set-env-vars "CSRF_TRUSTED_ORIGINS=$FRONTEND_URL"
```
> ⏳ This takes **2-3 minutes**.

### Step 3.6 — Get the Backend URL (save this!)

```powershell
$BACKEND_URL = gcloud run services describe fitflow-backend --region us-central1 --format "value(status.url)"
Write-Host "Backend URL: $BACKEND_URL"
```
> ✅ **Copy this URL.** It will look like: `https://fitflow-backend-XXXXXXXXXX.us-central1.run.app`
> **You will need this in Phase 5 (Frontend).**

---

## 🗃️ PHASE 4 — RUN DATABASE MIGRATIONS

We run migrations via a Cloud Run Job so we don't need a direct DB connection locally.

### Step 4.1 — Make sure you are still in project root

```powershell
cd "d:\Coding\Fit Flow - TOM"
Get-Location
```

### Step 4.2 — Create the Migration Job

```powershell
gcloud run jobs create migrate-db-job `
    --image us-central1-docker.pkg.dev/$PROJECT_ID/fitflow-repo/fitflow-backend `
    --region us-central1 `
    --command python `
    --args="manage.py","migrate" `
    --set-cloudsql-instances $DB_CONNECTION_NAME `
    --set-env-vars "DJANGO_SETTINGS_MODULE=config.settings_production" `
    --set-env-vars "SECRET_KEY=$SECRET_KEY" `
    --set-env-vars "DB_HOST=/cloudsql/$DB_CONNECTION_NAME" `
    --set-env-vars "DB_NAME=fitflow" `
    --set-env-vars "DB_USER=postgres" `
    --set-env-vars "DB_PASSWORD=$DB_PASSWORD" `
    --set-env-vars "DB_PORT=5432"
```

### Step 4.3 — Execute the Migration

```powershell
gcloud run jobs execute migrate-db-job --region us-central1 --wait
```
> ⏳ Wait for: `Execution ... completed successfully`

### Step 4.4 — Verify Migration (check logs)

```powershell
gcloud run jobs executions list --job=migrate-db-job --region us-central1
```

---

## 🪣 PHASE 5 — CREATE GCS MEDIA BUCKET

### Step 5.1 — Create the storage bucket

```powershell
gcloud storage buckets create gs://fitflow-media `
    --location=us-central1 `
    --uniform-bucket-level-access
```

### Step 5.2 — Allow public read access for images

```powershell
gcloud storage buckets add-iam-policy-binding gs://fitflow-media `
    --member=allUsers `
    --role=roles/storage.objectViewer
```

### Step 5.3 — Get the Cloud Run service account

```powershell
$CR_SA = gcloud run services describe fitflow-backend --region us-central1 --format "value(spec.template.spec.serviceAccountName)"
Write-Host "Cloud Run Service Account: $CR_SA"
```

### Step 5.4 — Grant Cloud Run permission to upload to bucket

```powershell
gcloud storage buckets add-iam-policy-binding gs://fitflow-media `
    --member="serviceAccount:$CR_SA" `
    --role=roles/storage.objectAdmin
```

### Step 5.5 — Apply CORS policy to allow frontend image loading

First, navigate to project root:
```powershell
cd "d:\Coding\Fit Flow - TOM"
```

Create the CORS config file:
```powershell
@'
[
  {
    "origin": ["https://fitflow-qms.web.app", "https://fitflow-qms.firebaseapp.com"],
    "method": ["GET"],
    "responseHeader": ["Content-Type"],
    "maxAgeSeconds": 3600
  }
]
'@ | Out-File -Encoding UTF8 cors.json
```

Apply CORS:
```powershell
gcloud storage buckets update gs://fitflow-media --cors-file=cors.json
```

---

## 🌐 PHASE 6 — SETUP FIREBASE (Frontend)

### Step 6.1 — Login to Firebase with new account

```powershell
firebase login
```
> 🌐 Browser opens — sign in with `husnainakhtar0110@gmail.com`

### Step 6.2 — Verify Firebase login

```powershell
firebase projects:list
```
> ✅ You should see `fitflow-QMS` in the list.
> If NOT, go to https://console.firebase.google.com and create the Firebase project first, then re-run this step.

### Step 6.3 — Update frontend Firebase project config

```powershell
cd "d:\Coding\Fit Flow - TOM\frontend"
```

Edit `.firebaserc` to point to new project:
```powershell
@'
{
  "projects": {
    "default": "fitflow-qms"
  }
}
'@ | Out-File -Encoding UTF8 .firebaserc
```

### Step 6.4 — Update frontend API URL to new backend

```powershell
# REPLACE the URL below with the ACTUAL backend URL from Step 3.6
$BACKEND_URL = "https://fitflow-backend-XXXXXXXXXX.us-central1.run.app"

"VITE_API_URL=$BACKEND_URL" | Out-File -Encoding UTF8 .env.production
```
> ⚠️ **Replace the URL with your actual backend URL from Step 3.6.**

### Step 6.5 — Verify the .env.production file is correct

```powershell
Get-Content .env.production
```
> ✅ Must show your actual Cloud Run URL.

### Step 6.6 — Install frontend dependencies (if needed)

```powershell
npm install
```

### Step 6.7 — Build the production frontend

```powershell
npm run build
```
> ✅ Must end with: `✓ built in X.XXs` — no errors.

### Step 6.8 — Deploy frontend to Firebase Hosting

```powershell
firebase deploy --only hosting
```
> ✅ You will get a "Hosting URL" at the end — that is your live app!

### Step 6.9 — Go back to project root

```powershell
cd ..
Get-Location
```
> ✅ Must show: `d:\Coding\Fit Flow - TOM`

---

## ✅ PHASE 7 — FINAL VERIFICATION

### Step 7.1 — Test backend is running

```powershell
# Replace with your actual backend URL
Invoke-WebRequest -Uri "https://fitflow-backend-XXXXXXXXXX.us-central1.run.app/api/" -Method GET
```
> ✅ Should return a 200 or 401 (not a 500 error).

### Step 7.2 — Open the live app in browser

```powershell
Start-Process "https://fitflow-qms.web.app"
```
> ✅ App should load. Try logging in.

---

## 🔄 FUTURE DEPLOYMENTS (After First Setup)

Once everything above is done, use these short commands for all future code updates:

### Backend Update Only

```powershell
cd "d:\Coding\Fit Flow - TOM"

# Set vars
$PROJECT_ID = "fitflow-qms"
$DB_CONNECTION_NAME = "fitflow-qms:us-central1:fitflow-db"
$DB_PASSWORD = "YOUR_STRONG_DB_PASSWORD_HERE"
$SECRET_KEY = "YOUR_GENERATED_SECRET_KEY_HERE"
$FRONTEND_URL = "https://fitflow-qms.web.app"

# Build and deploy
gcloud builds submit --tag us-central1-docker.pkg.dev/$PROJECT_ID/fitflow-repo/fitflow-backend

gcloud run deploy fitflow-backend `
    --image us-central1-docker.pkg.dev/$PROJECT_ID/fitflow-repo/fitflow-backend `
    --platform managed `
    --region us-central1 `
    --memory 1Gi `
    --allow-unauthenticated `
    --add-cloudsql-instances $DB_CONNECTION_NAME `
    --set-env-vars "DJANGO_SETTINGS_MODULE=config.settings_production" `
    --set-env-vars "SECRET_KEY=$SECRET_KEY" `
    --set-env-vars "DB_HOST=/cloudsql/$DB_CONNECTION_NAME" `
    --set-env-vars "DB_NAME=fitflow" `
    --set-env-vars "DB_USER=postgres" `
    --set-env-vars "DB_PASSWORD=$DB_PASSWORD" `
    --set-env-vars "DB_PORT=5432" `
    --set-env-vars "GCP_PROJECT_ID=$PROJECT_ID" `
    --set-env-vars "GCS_BUCKET_NAME=fitflow-media" `
    --set-env-vars "CORS_ALLOWED_ORIGINS=$FRONTEND_URL" `
    --set-env-vars "CSRF_TRUSTED_ORIGINS=$FRONTEND_URL"
```

### Frontend Update Only

```powershell
cd "d:\Coding\Fit Flow - TOM\frontend"
npm run build
firebase deploy --only hosting
cd ..
```

### Run Migrations After Model Changes

```powershell
cd "d:\Coding\Fit Flow - TOM"

# First make sure migrations are created locally
python manage.py makemigrations

# Then re-build and run the migration job
gcloud builds submit --tag us-central1-docker.pkg.dev/fitflow-qms-2026/fitflow-repo/fitflow-backend

gcloud run jobs update migrate-db-job `
    --image us-central1-docker.pkg.dev/fitflow-qms-2026/fitflow-repo/fitflow-backend `
    --region us-central1

gcloud run jobs execute migrate-db-job --region us-central1 --wait
```

---

## 🛑 COMMON ERRORS & FIXES

| Error | Cause | Fix |
|---|---|---|
| `Dockerfile required` | Wrong directory | Run `cd "d:\Coding\Fit Flow - TOM"` first |
| `SIGKILL` / `503` | Out of Memory | Add `--memory 1Gi` to deploy command |
| `CORS Error` | Wrong URL in env | Check `frontend/.env.production` has correct Cloud Run URL |
| `403 CSRF Failed` | Missing settings | Ensure `DJANGO_SETTINGS_MODULE=config.settings_production` is set |
| `DB connection refused` | DB not linked | Ensure `--add-cloudsql-instances` is in the deploy command |
| `No module named X` | Missing deps | Run `pip install -r requirements.txt` and rebuild |
| Firebase `403 Forbidden` | Wrong project | Run `firebase login` and check `.firebaserc` has `fitflow-qms` |

---

## 📝 IMPORTANT VALUES TO SAVE

> Fill this in as you complete the steps above.

| Item | Your Value |
|---|---|
| GCP Project ID | `fitflow-qms` |
| DB Instance Name | `fitflow-qms:us-central1:fitflow-db` |
| DB Password | *(save securely — do not share)* |
| Django SECRET_KEY | *(save securely — do not share)* |
| Backend Cloud Run URL | *(fill in after Step 3.6)* |
| Frontend Firebase URL | `https://fitflow-qms.web.app` |
| GCS Media Bucket | `gs://fitflow-media` |
