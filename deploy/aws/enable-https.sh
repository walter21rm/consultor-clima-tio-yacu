#!/bin/bash
set -euxo pipefail

cat >/tmp/consultor-clima.conf <<'NGINX'
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name climaswally.duckdns.org 44.199.86.96 _;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
NGINX

sudo cp /tmp/consultor-clima.conf /etc/nginx/conf.d/consultor-clima.conf
sudo nginx -t
sudo systemctl reload nginx
sudo dnf install -y certbot python3-certbot-nginx
sudo certbot --nginx -d climaswally.duckdns.org --non-interactive --agree-tos --register-unsafely-without-email --redirect
sudo systemctl enable --now certbot-renew.timer
