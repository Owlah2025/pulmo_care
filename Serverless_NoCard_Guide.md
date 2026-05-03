# 🚀 Pulmo Care — No-Card Serverless Deployment Guide

This guide explains how to deploy the entire stack for $0 without using a credit card.

## 1. Database (Neon.tech)
1. Sign up at [Neon.tech](https://neon.tech/) using GitHub.
2. Create a new project named `pulmo-care`.
3. Copy the **Connection String** from the dashboard.
   - It looks like: `postgresql://alex:abc1234@ep-cool-darkness-123456.us-east-2.aws.neon.tech/neondb?sslmode=require`

## 2. Redis (Upstash)
1. Sign up at [Upstash.com](https://upstash.com/).
2. Create a **Redis** database (Global or choosing a region near you).
3. Copy the **Redis URL**.
   - It looks like: `redis://default:abc1234@cool-slug-12345.upstash.io:6379`

## 3. Backend API (Render.com)
1. Push your code to a GitHub repository.
2. Sign up at [Render.com](https://render.com/).
3. Click **New +** -> **Web Service**.
4. Connect your GitHub repository.
5. **Settings**:
   - **Name**: `pulmo-backend`
   - **Runtime**: `Docker`
   - **Plan**: `Free`
6. **Environment Variables**: Click "Advanced" and add:
   - `DATABASE_URL`: (Paste from Neon)
   - `REDIS_URL`: (Paste from Upstash)
   - `CORS_ORIGINS`: `["*"]`
7. Click **Create Web Service**. 
   - *Note: Once deployed, copy your service URL (e.g., `https://pulmo-backend.onrender.com`).*

## 4. Frontend Dashboard (Vercel)
1. Sign up at [Vercel.com](https://vercel.com/) using GitHub.
2. Click **Add New** -> **Project**.
3. Import your GitHub repository.
4. **Project Settings**:
   - **Root Directory**: `dashboard`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
5. **Environment Variables**:
   - `VITE_API_URL`: (Paste your Render URL from Step 3)
6. Click **Deploy**.

## 5. Initialize Database
Once Render is "Live", you need to run migrations. Render doesn't give you a terminal easily on the Free tier, so you can run this locally once while pointing to the Neon DB:

```bash
# From your local /backend folder:
export DATABASE_URL="your_neon_connection_string"
alembic upgrade head
python seed_demo.py
```

---

### Key Notes for Free Tiers:
- **Spin-up time**: Render's free tier "sleeps" after 15 minutes of inactivity. The first person to visit the site will wait ~30 seconds for the backend to wake up.
- **Neon Storage**: The free tier has a 500MB limit, which is plenty for this app's initial launch.
- **Upstash**: Limits to 10,000 requests per day.



postgresql://neondb_owner:npg_bpjYTsEduF49@ep-small-band-amfb9p6z.c-5.us-east-1.aws.neon.tech/neondb?sslmode=require