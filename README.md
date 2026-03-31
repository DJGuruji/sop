## Local setup

### 1) Create `.env`

Copy `.env.example` to `.env` and fill values as needed.

### 2) Database

Set `DATABASE_URL` to a Postgres connection string, for example:

`postgresql://postgres:postgres@localhost:5432/sop?schema=public`

### 3) Migrate + seed

Run:

`npm run db:migrate`

`npm run db:seed`

### 4) Verify DB connectivity

Start the app:

`npm run dev`

Then open:

`/api/health`

---

## `.env.example`

```bash
NODE_ENV=development
NEXT_PUBLIC_API_URL=http://localhost:3000
BASE_URL=http://localhost:3000
NEXTAUTH_SECRET=
DATABASE_URL=
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=''
SMTP_FROM=
NEXT_PUBLIC_GOOGLE_RECAPTCHA_SITE_KEY=
GOOGLE_RECAPTCHA_SECRET_KEY=
AWS_REGION=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_S3_BUCKET=
# Optional: public base URL for downloads (e.g. CloudFront). If unset, URLs use virtual-hosted S3.
# AWS_S3_PUBLIC_BASE_URL=
```

### SOP library uploads (S3)

Uploaded SOP files (Word/PDF) are stored under the **`sop/`** prefix in `AWS_S3_BUCKET`. The document version’s `content.sourceFileUrl` in the database is the full HTTPS URL used for download links.

Ensure your bucket (or CDN behind `AWS_S3_PUBLIC_BASE_URL`) allows clients to **read** those objects if you use direct links in the admin UI.

Deleting an unpublished SOP from the admin UI **removes matching objects under `sop/` in S3** (when the stored URL maps to your bucket/CDN), then **permanently deletes** the document, its versions, and approval requests in the database. The IAM user needs **`s3:DeleteObject`** on `arn:aws:s3:::<bucket>/sop/*`.