# NESTI Service Files

Backup file systemd service untuk deployment.

## Files

| File | Service | Port |
|------|---------|------|
| `nesti-nextjs.service` | Next.js frontend | 3000 |
| `nesti-scanner.service` | Python API + Telegram Bot | 8090 |

## Install Service

```bash
# Copy ke systemd
sudo cp nesti-nextjs.service /etc/systemd/system/
sudo cp nesti-scanner.service /etc/systemd/system/

# Reload systemd
sudo systemctl daemon-reload

# Enable & start
sudo systemctl enable nesti-nextjs nesti-scanner
sudo systemctl start nesti-nextjs nesti-scanner
```

## Commands

```bash
# Status
systemctl status nesti-nextjs
systemctl status nesti-scanner

# Restart
systemctl restart nesti-nextjs
systemctl restart nesti-scanner

# Logs
journalctl -u nesti-nextjs -f
journalctl -u nesti-scanner -f

# Stop
systemctl stop nesti-nextjs
systemctl stop nesti-scanner
```

## Quick Restart All

```bash
systemctl restart nesti-nextjs && systemctl restart nesti-scanner
```

## Troubleshooting

```bash
# Cek port
lsof -i :3000
lsof -i :8090

# Cek error logs
journalctl -u nesti-scanner -p err --since "10 min ago"

# Test health
curl http://127.0.0.1:8090/health
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000/
```
