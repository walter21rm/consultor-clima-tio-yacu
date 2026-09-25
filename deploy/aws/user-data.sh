#!/bin/bash
set -euxo pipefail

dnf update -y
dnf install -y nginx git tar

# Node.js 20 LTS
curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
dnf install -y nodejs

mkdir -p /opt/consultor-clima
chown ec2-user:ec2-user /opt/consultor-clima

cat >/etc/nginx/conf.d/consultor-clima.conf <<'NGINX'
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

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

rm -f /etc/nginx/conf.d/default.conf || true
if [ -f /etc/nginx/nginx.conf ]; then
  sed -i 's/default_server//g' /etc/nginx/nginx.conf || true
fi

systemctl enable nginx
systemctl restart nginx

cat >/etc/systemd/system/consultor-clima.service <<'UNIT'
[Unit]
Description=Consultor de Clima
After=network.target

[Service]
Type=simple
User=ec2-user
WorkingDirectory=/opt/consultor-clima
Environment=NODE_ENV=production
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
touch /var/lib/cloud/instance/consultor-bootstrap-ok
