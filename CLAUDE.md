# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

PictureRepair is a WeChat Mini Program for old photo restoration. Users upload photos, choose a repair mode (colorize or enhance), and download the restored result. The system uses a credit-based billing model with mock payment for development.

## Architecture

Three independent applications share this repo:

- **backend/** — FastAPI async API (Python). Uses SQLAlchemy async with PostgreSQL, Alembic for migrations, Redis for caching, MinIO or Alibaba OSS for object storage. Image generation via Volcengine/Ark SDK (Doubao/Seedream models).
- **admin-web/** — Admin dashboard (React 18 + TypeScript + Vite + Tailwind CSS). Uses Zustand for state, React Router for routing, Axios for API calls.
- **miniprogram/** — WeChat Mini Program frontend. Vanilla JS with WXML/WXSS.

## Development Commands

### Start local dependencies (Postgres, Redis, MinIO)
```bash
docker compose up -d
```

### Backend
```bash
cd backend
pip install -r requirements.txt
python scripts/init_db.py          # Initialize database tables
python -m uvicorn app.main:app --reload --port 8000
```

Database migrations (Alembic config is at `backend/alembic.ini`):
```bash
alembic -c backend/alembic.ini upgrade head
alembic -c backend/alembic.ini revision --autogenerate -m "description"
```

### Admin Web
```bash
cd admin-web
npm install
npm run dev        # Dev server with proxy to backend
npm run build      # TypeScript check + Vite production build
npm run check      # TypeScript type checking only
npm run lint       # ESLint
npm test           # Vitest (jsdom environment)
```

### Miniprogram
Open `miniprogram/` in WeChat DevTools. No build step.

## Key Environment Variables

Copy `.env.example` to `.env`. Critical settings:

| Variable | Purpose |
|---|---|
| `STORAGE_TYPE` | `minio` (local) or `oss` (Alibaba Cloud) |
| `MOCK_IMAGE_GENERATION` | `true` skips real model calls, returns input image as result |
| `MOCK_WECHAT_LOGIN` | `true` skips WeChat API calls, uses mock openid/phone |
| `PAYMENT_USE_TEST_PRICES` | `true` switches to minimal test prices (1-3 cents) |
| `AUTO_CREATE_TABLES` | `true` creates tables on startup (dev only; use Alembic in prod) |
| `IMAGE_MODEL` | `doubao` (Seedream 5.0) or `jimeng` (Jimeng 4.0) |

## API Structure

All endpoints are under `/api/v1/`:

- `/auth/` — WeChat login, mock login, phone binding, user info
- `/photos/` — Image upload to MinIO/OSS
- `/repair/` — Create repair tasks, poll status, export results
- `/payments/` — Package listing, mock purchase, orders, transactions
- `/tasks/` — General task listing
- `/admin/` — Admin management endpoints
- `/routes/` — Route data endpoints

## Key Patterns

- All DB operations are async (`AsyncSession`, `await`).
- Task IDs are exposed externally as `task_id` (not `id`). Keep this consistent.
- Export is idempotent: re-exporting the same task does not re-charge.
- 402 status = insufficient credits.
- Background tasks handle image generation (via `BackgroundTasks`).
- The `admin-web` dev server proxies `/api` to `http://127.0.0.1:8000` via Vite config.

## Production Deployment

See `DEPLOYMENT.md` and `deploy/GO_LIVE_CHECKLIST.md`. Key points:
- Use Alembic migrations, not `AUTO_CREATE_TABLES`
- Set `MOCK_IMAGE_GENERATION=false`, `MOCK_WECHAT_LOGIN=false`
- Replace `SECRET_KEY` with a strong random value
- Nginx serves admin-web static files and reverse-proxies `/api/` to FastAPI
- Systemd service example at `deploy/systemd/picturerepair-api.service.example`
