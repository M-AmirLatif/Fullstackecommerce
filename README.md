# Full Stack Ecommerce

A full-stack ecommerce app built with Express, MongoDB, and server-rendered views.
Includes authentication, cart, checkout, and admin tools with demo payments.

## Features
- User register/login with sessions
- Product catalog with filters, pagination, and detail pages
- Semantic product search (free local embeddings + FAISS)
- AI shopping assistant chatbot (free local retrieval + rules)
- Admin AI tools for descriptions, highlights, tags, FAQs, and auto-fill
- Session-based cart with add/remove
- Demo checkout (no real payments)
- Inventory tracking with stock validation
- Admin product CRUD and order management
- Responsive UI with Pug templates and custom CSS

## Tech Stack
- Node.js, Express
- MongoDB, Mongoose
- Pug templates
- FastAPI + FAISS semantic search (free, local)

## Screenshots
Add screenshots under `docs/screenshots/` and update the links below:
- `docs/screenshots/home.png`
- `docs/screenshots/product.png`
- `docs/screenshots/checkout.png`
- `docs/screenshots/admin-orders.png`

## Environment Variables
Create a `.env` file (see `.env.example`):
- `MONGO_URI`
- `MONGO_DB` (optional if `MONGO_URI` includes the database)
- `SESSION_SECRET`
- `AI_SERVICE_URL`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` (for signup OTP email)
- `OTP_EXPIRES_MIN` (default 10)

## Install and Run
```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Semantic Search (Free, Local)
The AI service runs separately and powers semantic search on `/shop` via `q=`.

```bash
cd ai_service
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe build_index.py
.\.venv\Scripts\uvicorn.exe app:app --host 127.0.0.1 --port 8002
```

Set `AI_SERVICE_URL` in `.env` if the service runs elsewhere.
The AI service also reads `MONGO_URI` and `MONGO_DB` from the environment.

You can also rebuild the index from the project root:
```bash
npm run ai:index
```

## AI Shopping Assistant (Free, Local)
The assistant is available on every page and uses the same AI service. It retrieves top matches
and responds with catalog-grounded answers.

## Admin AI Tools (Free, Local)
Admin product forms include buttons that generate descriptions, highlights, SEO tags, FAQs,
and auto-fill colors/category. These require the AI service to be running.

## Local LLM (Free)
For real AI responses, install Ollama and pull a small model:
```bash
ollama pull qwen2.5:0.5b
```

The AI service will automatically use Ollama at `http://127.0.0.1:11434`.
You can change the model with `AI_OLLAMA_MODEL` in `.env`.

## Cloud LLM (Best Quality)
Set `AI_LLM_PROVIDER=openai` and provide:
- `OPENAI_API_KEY`
- `AI_OPENAI_MODEL` (default `gpt-4o-mini`)

Then restart the AI service.

## Gemini (Alternative Cloud LLM)
Set `AI_LLM_PROVIDER=gemini` and provide:
- `GEMINI_API_KEY`
- `AI_GEMINI_MODEL` (default `gemini-1.5-flash`)

Then restart the AI service.


## Demo Credentials
None by default. Register a new user or run any project seeder you maintain.

## Create an Admin User
Register a user first, then promote:
```bash
npm run make-admin -- user@example.com
```

## Deployment Notes
- Use a persistent session store (MongoDB sessions via `connect-mongo`).
- If deploying behind a proxy, ensure `NODE_ENV=production` so `trust proxy` and secure cookies are enabled.

## Recommended Deployment (Best Fit)
This project is best deployed as **2 services**:

1. **Web app (Express + Pug)** -> **Vercel**
2. **AI service (FastAPI + FAISS)** -> **Render/Railway** (not Vercel serverless)

Why: the AI service uses `sentence-transformers` + `faiss-cpu` and local index files, which are not a good fit for Vercel serverless runtime limits.

### Deploy Web App to Vercel
- Deploy folder: `EcommerceFullStackProject/`
- Vercel uses:
  - `vercel.json`
  - `api/index.js`
- Set Vercel env vars:
  - `MONGO_URI`
  - `MONGO_DB`
  - `SESSION_SECRET`
  - `AI_SERVICE_URL` (your deployed AI service URL)
  - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`
  - `APP_BASE_URL` (your Vercel domain)
  - LLM keys (`GEMINI_API_KEY` / `OPENAI_API_KEY`) only if web routes need them directly

### Deploy AI Service to Render/Railway
- Deploy folder: `EcommerceFullStackProject/ai_service/`
- Included helper files:
  - `Procfile`
  - `runtime.txt`
  - `render.yaml`
- Set env vars:
  - `MONGO_URI`
  - `MONGO_DB`
  - `AI_LLM_PROVIDER`
  - `AI_GEMINI_MODEL` / `AI_OPENAI_MODEL`
  - `GEMINI_API_KEY` / `OPENAI_API_KEY`
  - `AI_CHAT_MODE=llm`
  - `AI_DEBUG=0` (recommended in production)

## Demo Payment Webhook
- Orders now start as `Pending` and can be updated by webhook events.
- Demo webhook endpoint: `POST /payments/webhook/demo`
- Payload example:
  - `{"event":"payment.succeeded","orderId":"<order_id>","transactionId":"demo_txn_123"}`
- Optional signature header:
  - `X-Demo-Signature: <hmac_sha256_hex_of_raw_json_with_DEMO_WEBHOOK_SECRET>`
