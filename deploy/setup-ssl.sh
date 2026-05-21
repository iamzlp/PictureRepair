#!/bin/bash
# SSL certificate setup script for repairpic.lstcloud.com
# Uses acme.sh with Let's Encrypt
#
# Prerequisites:
#   1. DNS A record: repairpic.lstcloud.com -> server public IP
#   2. Port 80 accessible from internet (forwarded through cloud LB if needed)
#   3. nginx installed and running
#
# Usage: sudo bash deploy/setup-ssl.sh

set -e

DOMAIN="repairpic.lstcloud.com"
SSL_DIR="/etc/nginx/ssl/${DOMAIN}"
ACME_HOME="/root/.acme.sh"
NGINX_CONF="/etc/nginx/sites-available/${DOMAIN}.conf"

echo "=== SSL Certificate Setup for ${DOMAIN} ==="

# Check prerequisites
echo "[1/6] Checking prerequisites..."
if ! command -v nginx &> /dev/null; then
    echo "ERROR: nginx not installed. Run: apt install nginx"
    exit 1
fi
if [ ! -f "${ACME_HOME}/acme.sh" ]; then
    echo "ERROR: acme.sh not installed. Run: curl https://get.acme.sh | sh -s email=admin@lstcloud.com"
    exit 1
fi

# Switch to Let's Encrypt
echo "[2/6] Setting Let's Encrypt as default CA..."
${ACME_HOME}/acme.sh --set-default-ca --server letsencrypt

# Prepare challenge directory
echo "[3/6] Preparing ACME challenge directory..."
mkdir -p /var/www/html/.well-known/acme-challenge

# Use temporary HTTP-only config for validation
echo "[4/6] Applying temporary HTTP config for validation..."
cat > ${NGINX_CONF} << 'NGINX_CONF_EOF'
server {
    listen 80;
    server_name repairpic.lstcloud.com;

    location /.well-known/acme-challenge/ {
        root /var/www/html;
        allow all;
    }

    location / {
        return 200 'SSL setup in progress';
        add_header Content-Type text/plain;
    }
}
NGINX_CONF_EOF

ln -sf ${NGINX_CONF} /etc/nginx/sites-enabled/${DOMAIN}.conf
nginx -t && systemctl reload nginx

# Issue certificate
echo "[5/6] Issuing SSL certificate (this may take a minute)..."
${ACME_HOME}/acme.sh --issue \
    -d ${DOMAIN} \
    --webroot /var/www/html \
    --force

# Install certificate
echo "[6/6] Installing certificate to nginx..."
mkdir -p ${SSL_DIR}
${ACME_HOME}/acme.sh --install-cert -d ${DOMAIN} \
    --ecc \
    --cert-file      ${SSL_DIR}/cert.pem \
    --key-file       ${SSL_DIR}/privkey.pem \
    --fullchain-file ${SSL_DIR}/fullchain.pem \
    --reloadcmd      "systemctl reload nginx"

# Apply full HTTPS config
echo "Applying full HTTPS nginx config..."
cat > ${NGINX_CONF} << 'NGINX_FULL_EOF'
server {
    listen 80;
    server_name repairpic.lstcloud.com;

    location /.well-known/acme-challenge/ {
        root /var/www/html;
        allow all;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl http2;
    server_name repairpic.lstcloud.com;

    ssl_certificate     /etc/nginx/ssl/repairpic.lstcloud.com/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/repairpic.lstcloud.com/privkey.pem;
    ssl_session_timeout 1d;
    ssl_session_cache   shared:SSL:10m;
    ssl_session_tickets off;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers off;

    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options SAMEORIGIN;
    add_header X-Content-Type-Options nosniff;
    add_header Referrer-Policy strict-origin-when-cross-origin;

    root /www/PictureRepair/admin-web/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
        proxy_connect_timeout 10s;
        client_max_body_size 20m;
    }
}
NGINX_FULL_EOF

nginx -t && systemctl reload nginx

echo ""
echo "=== Setup Complete ==="
echo "Certificate files:"
echo "  Full chain: ${SSL_DIR}/fullchain.pem"
echo "  Private key: ${SSL_DIR}/privkey.pem"
echo ""
echo "Auto-renewal: acme.sh cron is active (renews at 30 days before expiry)"
echo "Test: curl -I https://${DOMAIN}/"
echo "Renewal test: ${ACME_HOME}/acme.sh --renew -d ${DOMAIN} --ecc --force"
