# Protestat relay (optional group server)

A small mailbox that lets a group of Protestat phones share reports. It is **optional**: the app works without it.

- Stores only **encrypted** data. The group key stays on the phones, so the server cannot read anything.
- Deletes everything after **72 hours** (`TTL_HOURS`).
- No accounts, no database, no dependencies. One file: `relay.mjs` (Node.js 18+).

> The server **can** see the IP addresses of connecting phones and when they connect. Run it yourself or use one you trust.

## Option 1 — on an Android phone (no server needed)

In the app: **Share → Create a group → On this phone**. Works for people on the same Wi‑Fi or connected to that phone's hotspot, even without internet.

## Option 2 — any computer or VPS, quickest

```bash
curl -O https://raw.githubusercontent.com/Eri4/protestat/main/server/relay.mjs
node relay.mjs                                   # listens on port 8787
cloudflared tunnel --url http://localhost:8787  # free https://….trycloudflare.com address
```

Paste the `https://…trycloudflare.com` address into the app (**Create a group → On my server**). The tunnel address changes each time you restart `cloudflared`.

## Option 3 — VPS with your own domain and automatic HTTPS

```bash
git clone https://github.com/Eri4/protestat && cd protestat/server
# edit Caddyfile: put your domain instead of relay.example.org
docker compose up -d
```

Use `https://your-domain` in the app.

## Option 4 — Docker image only

```bash
docker run -d --restart unless-stopped -p 8787:8787 -v protestat:/data ghcr.io/eri4/protestat-relay
```

Without HTTPS this works only from the Android app on a local network; put it behind HTTPS (Option 2 or 3) for internet use.

## Settings (environment variables)

| Variable | Default | Meaning |
| --- | --- | --- |
| `PORT` | 8787 | Port to listen on |
| `HOST` | 0.0.0.0 | Address to listen on |
| `DATA_DIR` | ./data | Where the encrypted blobs are kept |
| `TTL_HOURS` | 72 | Delete blobs older than this |
| `MAX_GROUP_ITEMS` | 2000 | Keep at most this many blobs per group |
| `MAX_GROUPS` | 2000 | Maximum number of groups |
| `POSTS_PER_MIN` | 120 | Uploads allowed per IP per minute |

## Protocol (v1)

```
GET  /v1/health                         -> { ok, app: "protestat-relay", version: 1, ttlHours }
POST /v1/g/<group>/blobs  {iv, data}    -> 201 { seq }
GET  /v1/g/<group>/blobs?after=N        -> { items: [{ seq, t, iv, data }], next }
```

The phone server (`android/.../relay/RelayServer.java`) implements the same protocol; `tests/relay.test.ts` checks both.
