# 🚀 Pulmo Care — No-Card Serverless Deployment Guide

This guide explains how to deploy the entire stack for $0 without using a credit card or being in a restricted region.

## 1. Database (Neon.tech)
1. Sign up at [Neon.tech](https://neon.tech/) using GitHub.
2. Create a new project named `pulmo-care`.
3. Copy the **Connection String** from the dashboard.
   - It looks like: `postgresql://alex:abc1234@ep-cool-darkness-123456.us-east-2.aws.neon.tech/neondb?sslmode=require`

## 2. Redis (Upstash)
1. Sign up at [Upstash.com](https://upstash.com/).
2. Create a **Redis** database.
3. Copy the **Redis URL**.
   - It looks like: `redis://default:abc1234@cool-slug-12345.upstash.io:6379`

## 3. Backend API (Hugging Face Spaces)
Hugging Face Spaces is a great way to host Docker-based APIs for free without a card.

1. Sign up at [HuggingFace.co](https://huggingface.co/).
2. Click **New Space**.
3. **Name**: `pulmo-backend`.
4. **SDK**: Choose **Docker**.
5. **Hardware**: Choose the free "CPU Basic" (16GB RAM).
6. Click **Create Space**.
7. Go to the **Settings** tab of your new Space:
   - Scroll to **Variables and Secrets**.
   - Add **New Secret**: `DATABASE_URL` (Paste from Neon).
   - Add **New Secret**: `REDIS_URL` (Paste from Upstash).
   - Add **New Variable**: `CORS_ORIGINS` value `["*"]`.
8. Connect your GitHub:
   - In Settings, find **Connected GitHub Repository**.
   - Link your `pulmo_care` repo.
   - Set **Context Directory** to `backend`.
9. The Space will build and show "Running". Your API URL will look like:
   `https://[username]-pulmo-backend.hf.space`

## 4. Frontend Dashboard (Vercel)
1. Sign up at [Vercel.com](https://vercel.com/) using GitHub.
2. Click **Add New** -> **Project**.
3. Import your GitHub repository.
4. **Project Settings**:
   - **Root Directory**: `dashboard`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
5. **Environment Variables**:
   - `VITE_API_URL`: (Paste your Hugging Face Space URL from Step 3)
     *Note: Ensure there is no trailing slash.*
6. Click **Deploy**.

## 5. Initialize Database
Once the backend is Running, you need to run migrations. Run this locally once while pointing to the Neon DB:

```bash
# From your local /backend folder:
export DATABASE_URL="your_neon_connection_string"
alembic upgrade head
python seed_demo.py
```

---

### Key Notes for Free Tiers:
- **Always On**: Hugging Face Spaces stay awake (no sleep mode like Render).
- **Resources**: You get 16GB of RAM, which is excellent for AI tasks.
- **Neon Storage**: The free tier has a 500MB limit.
- **Upstash**: Limits to 10,000 requests per day.
