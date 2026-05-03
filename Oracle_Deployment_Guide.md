# 🚀 Pulmo Care — Oracle Cloud Zero-Cost Deployment Guide

Deploying to Oracle Cloud's **Always Free** tier gives you a powerful server (up to 4 ARM Cores, 24GB RAM, 200GB storage) permanently for $0. It is perfect for running TimescaleDB and your Python backend 24/7 without sleep modes.

## Step 1: Create the Free Instance
1. Sign up for an [Oracle Cloud Account](https://www.oracle.com/cloud/free/).
2. Go to **Compute -> Instances -> Create Instance**.
3. **Image and Shape**: 
   - Choose **Canonical Ubuntu 22.04**.
   - Choose Shape: **Ampere ARM (VM.Standard.A1.Flex)**. Max out the free tier specs (4 OCPUs, 24GB RAM).
4. **Networking**: Ensure you assign a public IPv4 address.
5. **SSH Keys**: Download the private SSH key before creating the instance.
6. Click **Create**.

## Step 2: Open Firewall Ports
By default, Oracle blocks incoming traffic even if configured in Docker.
1. In the Oracle Dashboard, click your instance -> **Primary VNIC** -> **Subnet** -> **Security Lists**.
2. Add Ingress Rules for:
   - Port 80 (HTTP)
   - Port 443 (HTTPS)
3. SSH into your instance and open the Ubuntu firewall:
   ```bash
   sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
   sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
   sudo netfilter-persistent save
   ```

## Step 3: Install Docker and Docker Compose
SSH into your server:
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add your user to the docker group
sudo usermod -aG docker ubuntu

# Log out and log back in for changes to take effect!
```

## Step 4: Clone the Repo and Deploy
1. Upload your code to the server via Git or SCP.
2. Navigate to your project folder:
   ```bash
   cd pulmo-care
   ```
3. *(Optional but Recommended)*: If you have a domain name, point it to your server's IP address. Then edit the `Caddyfile` and replace `:80` with your domain (e.g., `pulmo.yourdomain.com`). Caddy will automatically generate free SSL certificates for you!
4. Start the stack:
   ```bash
   docker compose up -d --build
   ```

## Step 5: Initialize the Database
The first time you start up, the backend database will be empty. Run your migrations and seed data:
```bash
docker compose exec backend alembic upgrade head
docker compose exec backend python seed_demo.py
```

## Done! 🎉
Your app is now securely running on Oracle Cloud. 
- **Frontend Dashboard:** Available at `http://YOUR_SERVER_IP` (or your domain).
- **Backend API:** Traffic automatically routed through `/api/`.