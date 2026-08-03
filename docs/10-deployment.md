# 10 — Deployment

> [!NOTE]
> **Docker & Remote Deployment are Out of Scope.**
> The project scope is strictly limited to local development and local execution via Vite (`npm run dev` / `npm run preview`). This document is maintained for reference only.

## Deliverable

**One multi-arch Docker image** serving a static bundle over HTTP on port 8080, running as a non-root user, with a healthcheck, correct MIME types, cross-origin isolation headers, and runtime configuration via environment variables.

Target: works on Docker Swarm, Traefik, Coolify, Dokploy, Portainer, ECS, plain `docker run` on EC2, and any Kubernetes ingress, with **no configuration beyond a hostname**.

## The one thing that will bite you

**Cross-origin isolation requires a secure context.** `crossOriginIsolated` is `false` over plain HTTP to an IP address or a bare hostname, no matter how correct your headers are. Only HTTPS and `localhost` qualify.

Consequences:

- Testing on `http://<ec2-public-ip>:8080` will always show single-threaded mode. This is not a bug.
- Behind Traefik or Coolify with TLS terminated at the proxy, it works — the browser sees HTTPS, which is what matters.
- The app must degrade silently to single-threaded and cap the difficulty ladder at level 6. It must never show an error for this.

Document this in the repo README at the top, not buried. It is the number one support question this app will generate.

## Dockerfile

```dockerfile
# syntax=docker/dockerfile:1

# ---- build ----
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# ---- runtime ----
FROM nginxinc/nginx-unprivileged:1.27-alpine

USER root
RUN rm -f /etc/nginx/conf.d/default.conf \
 && apk add --no-cache wget

COPY docker/nginx.conf              /etc/nginx/nginx.conf
COPY docker/isolated.conf           /etc/nginx/available/isolated.conf
COPY docker/permissive.conf         /etc/nginx/available/permissive.conf
COPY docker/entrypoint.d/           /docker-entrypoint.d/

COPY --from=build /app/dist         /usr/share/nginx/html

RUN chown -R 101:101 /usr/share/nginx/html /etc/nginx \
 && chmod +x /docker-entrypoint.d/*.sh

USER 101

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:8080/healthz || exit 1

LABEL org.opencontainers.image.title="Voxel Chess" \
      org.opencontainers.image.description="Browser chess against Stockfish, voxel rendered" \
      org.opencontainers.image.licenses="GPL-3.0"
```

Why these choices:

- **`nginxinc/nginx-unprivileged`** listens on 8080 as uid 101 by default. No capability juggling, no root, works under restrictive orchestrators out of the box.
- **`/docker-entrypoint.d/`** is executed by the base image's entrypoint before nginx starts. This is the supported hook; do not override `ENTRYPOINT`.
- **`wget`** for the healthcheck — busybox wget is present but `--spider` behaviour is more reliable from the full package.

Expected image size: roughly 55–75MB. The Stockfish lite builds account for about 14MB of it.

## nginx configuration

### `docker/nginx.conf`

```nginx
worker_processes auto;
error_log  /dev/stderr warn;
pid        /tmp/nginx.pid;

events { worker_connections 1024; }

http {
  include       /etc/nginx/mime.types;
  types { application/wasm wasm; }
  default_type  application/octet-stream;

  access_log    /dev/stdout combined;
  sendfile      on;
  tcp_nopush    on;
  keepalive_timeout 65;
  server_tokens off;

  # Serve pre-compressed assets produced at build time.
  gzip_static   on;
  gzip          on;
  gzip_vary     on;
  gzip_types    text/plain text/css application/javascript
                application/json image/svg+xml application/wasm;
  gzip_min_length 1024;

  # Writable paths for the unprivileged user.
  client_body_temp_path /tmp/client_temp;
  proxy_temp_path       /tmp/proxy_temp;
  fastcgi_temp_path     /tmp/fastcgi_temp;
  uwsgi_temp_path       /tmp/uwsgi_temp;
  scgi_temp_path        /tmp/scgi_temp;

  server {
    listen 8080;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    # Isolation headers, swapped in by the entrypoint.
    include /etc/nginx/active-isolation.conf;

    location = /healthz {
      access_log off;
      add_header Content-Type text/plain;
      return 200 "ok\n";
    }

    # Hashed build assets — immutable.
    location /assets/ {
      expires 1y;
      add_header Cache-Control "public, immutable";
      include /etc/nginx/active-isolation.conf;
    }

    # Engine binaries — large, versioned by path, immutable.
    location /engine/ {
      expires 1y;
      add_header Cache-Control "public, immutable";
      include /etc/nginx/active-isolation.conf;
    }

    # Runtime config — never cached.
    location = /config.js {
      add_header Cache-Control "no-store";
      include /etc/nginx/active-isolation.conf;
    }

    # SPA shell — never cached.
    location / {
      try_files $uri $uri/ /index.html;
      add_header Cache-Control "no-cache";
      include /etc/nginx/active-isolation.conf;
    }
  }
}
```

**The repeated `include` inside every `location` is deliberate and mandatory.** nginx's `add_header` does not inherit into a block that declares its own `add_header`. Omitting the include from any location silently drops the isolation headers for that path, which breaks threading in a way that is genuinely painful to debug.

### `docker/isolated.conf` (default)

```nginx
add_header Cross-Origin-Opener-Policy   "same-origin"   always;
add_header Cross-Origin-Embedder-Policy "require-corp"  always;
add_header Cross-Origin-Resource-Policy "same-origin"   always;
add_header X-Content-Type-Options       "nosniff"       always;
add_header Referrer-Policy              "no-referrer"   always;
```

### `docker/permissive.conf`

```nginx
add_header X-Content-Type-Options "nosniff"     always;
add_header Referrer-Policy        "no-referrer" always;
```

Used when the app must be embedded in an iframe or served alongside third-party resources. Disables the multi-threaded engine.

### `docker/entrypoint.d/10-runtime-config.sh`

```sh
#!/bin/sh
set -e

# 1. Select the isolation header set.
if [ "${CHESS_ALLOW_EMBED:-false}" = "true" ]; then
  cp /etc/nginx/available/permissive.conf /etc/nginx/active-isolation.conf
  echo "[voxel-chess] embedding allowed; cross-origin isolation DISABLED"
else
  cp /etc/nginx/available/isolated.conf /etc/nginx/active-isolation.conf
fi

# 2. Emit runtime config consumed by the app before the bundle loads.
cat > /usr/share/nginx/html/config.js <<EOF
window.__CHESS_CONFIG__ = {
  defaultDifficulty: ${CHESS_DEFAULT_DIFFICULTY:-4},
  maxPremoves:       ${CHESS_MAX_PREMOVES:-3},
  enableClocks:      ${CHESS_ENABLE_CLOCKS:-false},
  analyticsUrl:      $( [ -n "${CHESS_ANALYTICS_URL}" ] && echo "\"${CHESS_ANALYTICS_URL}\"" || echo "null" )
};
EOF

echo "[voxel-chess] runtime config written"
```

`index.html` loads `<script src="/config.js"></script>` **before** the module bundle. The app must run correctly if the file is missing or malformed — wrap access in a defaulting accessor and never let a config parse failure block boot.

## Environment variables

| Variable | Default | Effect |
|---|---|---|
| `CHESS_DEFAULT_DIFFICULTY` | `4` | Level 1-8 preselected for new games |
| `CHESS_MAX_PREMOVES` | `3` | Premove queue depth |
| `CHESS_ENABLE_CLOCKS` | `false` | Show clocks |
| `CHESS_ALLOW_EMBED` | `false` | Drop isolation headers; disables multi-threading |
| `CHESS_ANALYTICS_URL` | unset | Optional beacon endpoint |

**All are optional.** `docker run -p 8080:8080 voxel-chess` must produce a fully working app.

## Building

```bash
docker buildx create --use --name voxel-chess 2>/dev/null || true

docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t ghcr.io/<owner>/voxel-chess:1.0.0 \
  -t ghcr.io/<owner>/voxel-chess:latest \
  --push .
```

arm64 is not optional — EC2 Graviton and Apple Silicon dev machines both need it, and the build has no native dependencies, so it is free.

## docker-compose.yml

Works unchanged for local use, `docker compose up`, and `docker stack deploy`.

```yaml
services:
  chess:
    image: ghcr.io/<owner>/voxel-chess:latest
    ports:
      - "8080:8080"
    environment:
      CHESS_DEFAULT_DIFFICULTY: "4"
    restart: unless-stopped
    deploy:
      replicas: 2
      update_config:
        order: start-first
      resources:
        limits:
          memory: 128M
    labels:
      traefik.enable: "true"
      traefik.http.routers.chess.rule: "Host(`chess.example.com`)"
      traefik.http.routers.chess.entrypoints: "websecure"
      traefik.http.routers.chess.tls.certresolver: "letsencrypt"
      traefik.http.services.chess.loadbalancer.server.port: "8080"
```

The container is stateless — all game data lives in the user's IndexedDB — so replicas scale freely with no session affinity and no shared volume.

## Platform recipes

### Traefik

The labels above are sufficient. Two things to verify:

1. **Traefik must not strip the isolation headers.** It does not by default. If you have a `headers` middleware applied globally, confirm it uses `customResponseHeaders` additively rather than replacing the set.
2. **TLS must terminate at Traefik**, which it does by default with a certresolver. Without HTTPS reaching the browser, threading stays off.

### Coolify

1. New resource → Docker image → `ghcr.io/<owner>/voxel-chess:latest`
2. Port: `8080`
3. Set a domain. Coolify provisions TLS automatically.
4. Environment variables optional.

No Dockerfile build needed on the Coolify host; use the prebuilt image. Coolify reads the `EXPOSE` directive, so port detection is automatic.

### Docker Swarm

```bash
docker stack deploy -c docker-compose.yml chess
```

Ensure the Traefik service is on the same overlay network. With `replicas: 2` and `order: start-first`, updates are zero-downtime.

### EC2, standalone

```bash
docker run -d \
  --name chess \
  --restart unless-stopped \
  -p 80:8080 \
  ghcr.io/<owner>/voxel-chess:latest
```

This works but serves plain HTTP, so threading stays off. For the full experience put Caddy or Traefik in front for TLS. A `t4g.nano` is more than sufficient — the container serves static files and idles at a few megabytes of memory.

### Kubernetes

Standard Deployment plus Service on 8080 plus Ingress. Add to the Ingress:

```yaml
nginx.ingress.kubernetes.io/configuration-snippet: |
  more_set_headers "Cross-Origin-Opener-Policy: same-origin";
  more_set_headers "Cross-Origin-Embedder-Policy: require-corp";
```

Some ingress controllers rewrite response headers; verify with `curl -I` against the public URL, not against the pod.

## Verification checklist

Run against the **deployed public URL**, not localhost, since the secure-context requirement only manifests in real deployment.

```bash
# 1. Health
curl -sf https://chess.example.com/healthz

# 2. Isolation headers present on the document
curl -sI https://chess.example.com/ | grep -i cross-origin
#    expect: Cross-Origin-Opener-Policy: same-origin
#            Cross-Origin-Embedder-Policy: require-corp

# 3. Isolation headers present on assets too (the easy one to miss)
curl -sI https://chess.example.com/assets/index-<hash>.js | grep -i cross-origin

# 4. WASM served with the correct type
curl -sI https://chess.example.com/engine/<engine>.wasm | grep -i content-type
#    expect: application/wasm

# 5. Pre-compressed assets are being served
curl -sI -H 'Accept-Encoding: gzip' https://chess.example.com/assets/index-<hash>.js \
  | grep -i content-encoding

# 6. Cache headers
curl -sI https://chess.example.com/assets/index-<hash>.js | grep -i cache-control
#    expect: public, immutable
curl -sI https://chess.example.com/ | grep -i cache-control
#    expect: no-cache
```

In the browser console on the deployed site:

```js
crossOriginIsolated          // must be true
typeof SharedArrayBuffer     // must be "function"
```

If `crossOriginIsolated` is `false` while the headers are present, the cause is almost always: not HTTPS, or a proxy stripping headers, or a `location` block missing the isolation include.

## Security posture

- No backend, no database, no user data leaving the browser. The attack surface is a static file server.
- Runs as uid 101, non-root, read-only-friendly. Add `read_only: true` with `tmpfs` mounts on `/tmp` and `/var/cache/nginx` if your platform supports it.
- `server_tokens off`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer` set.
- **No Content-Security-Policy is specified here** because WASM instantiation requires `'wasm-unsafe-eval'` in `script-src`, and getting the policy wrong silently breaks the engine. If you add one, add it last, test the engine explicitly, and start from `script-src 'self' 'wasm-unsafe-eval'`.
- Stockfish is GPL-3.0. The image redistributes it, so licence text must ship at `/licenses/` and be linked from the UI. See `02-tech-stack.md`.
