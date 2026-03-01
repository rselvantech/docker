# Dockerfile RUN Instruction & Advanced Docker Build

## Overview

This demo covers the `RUN` instruction in depth and advanced `docker build` concepts using a real-world use case: installing the `nginx-mod-http-headers-more` module to add custom HTTP response headers and remove the `Server` header for security hardening.

**What you'll learn:**
- RUN shell form vs exec form
- Layer optimization — chaining commands with `&&`
- How Docker layer cache works and cache invalidation
- `--no-cache` flag — when and why to use it
- Visualizing image layers with `docker history`
- Advanced `docker build` flags
- using nginx, add custom HTTP response headers and remove the `Server` header

---

## How Docker Layer Cache Works

Every instruction in a Dockerfile creates a new **read-only image layer**. Docker caches each layer and reuses it on subsequent builds if nothing has changed.

```
FROM nginx:alpine-slim        ← Layer 1: cached from Docker Hub
COPY nginx.conf /etc/...      ← Layer 2: cached if nginx.conf unchanged
RUN apk add --no-cache curl   ← Layer 3: cached if layers above unchanged
COPY html/ /usr/share/...     ← Layer 4: cache INVALIDATED if html/ changed
RUN echo "build done"         ← Layer 5: re-runs because Layer 4 changed ↑
```

**Key rule — cache invalidation cascades downward:**
- If any layer changes, ALL layers below it are invalidated and re-run
- Instruction order matters — put stable/slow things at the top, frequently changing things at the bottom

```
# ✅ Good order — stable layers on top
FROM nginx:alpine-slim
RUN apk add --no-cache curl        ← slow, stable — cached most of the time
COPY nginx.conf /etc/nginx/...     ← changes occasionally
COPY html/ /usr/share/nginx/html/  ← changes frequently — put at bottom
```

```
# ❌ Bad order — COPY before RUN
FROM nginx:alpine-slim
COPY html/ /usr/share/nginx/html/  ← changes frequently — invalidates RUN below!
RUN apk add --no-cache curl        ← re-runs every time html/ changes ❌
```

---

## RUN — Shell Form vs Exec Form

```dockerfile
# Shell form — runs via /bin/sh -c
RUN apk add --no-cache curl

# Exec form — runs directly, no shell
RUN ["apk", "add", "--no-cache", "curl"]
```

| | Shell Form | Exec Form |
|---|---|---|
| **Syntax** | `RUN command` | `RUN ["executable", "arg"]` |
| **Runs via** | `/bin/sh -c` | Directly |
| **Shell features** | ✅ `&&`, `\|`, variables | ❌ Not available |
| **Use for** | Multi-command chaining | Single commands |

For `RUN`, **shell form is preferred** when chaining multiple commands with `&&`. Exec form is preferred for `CMD` and `ENTRYPOINT`.

---

## Layer Optimization — Chain with `&&`

Each `RUN` instruction creates a new layer. More layers = larger image.

```dockerfile
# ❌ Bad — 3 separate RUN = 3 layers = larger image
RUN apk update
RUN apk add --no-cache nginx-mod-http-headers-more
RUN rm -rf /var/cache/apk/*

# ✅ Good — 1 RUN = 1 layer = smaller image
RUN apk update && \
    apk add --no-cache nginx-mod-http-headers-more && \
    rm -rf /var/cache/apk/*
```

**Why cleanup matters:** Even if you `rm` files in a later layer, the files still exist in the earlier layer and contribute to image size. Cleanup must happen **in the same RUN** as the install.

```dockerfile
# ❌ Cleanup in separate layer — does NOT reduce image size
RUN apk add nginx-mod-http-headers-more   # layer contains cache files
RUN rm -rf /var/cache/apk/*              # files still exist in layer above!

# ✅ Cleanup in same layer — actually reduces image size
RUN apk add nginx-mod-http-headers-more && \
    rm -rf /var/cache/apk/*              # removed in same layer ✅
```

---

## Project Structure

```
07-dockerfile-run/
├── src/
│   ├── html/
│   │   └── index.html
│   ├── nginx/
│   │   └── nginx.conf
│   ├── .dockerignore
│   ├── Dockerfile.bad      # unoptimized — multiple RUN layers
│   └── Dockerfile          # optimized — chained RUN, correct layer order
└── README.md
```

---

## Application Files

**`src/html/index.html`**
```html
<!DOCTYPE html>
<html>
<head><title>RUN Demo - Custom Headers</title></head>
<body>
  <h1>Nginx with Custom HTTP Headers</h1>
  <p>Use <code>curl -I http://localhost:8080</code> to see custom response headers.</p>
  <p>Notice: <code>Server</code> header is removed for security.</p>
</body>
</html>
```

**`src/nginx/nginx.conf`**
```nginx
# Load the headers-more module
load_module modules/ngx_http_headers_more_filter_module.so;

events {}

http {
    server {
        listen 80;
        root /usr/share/nginx/html;
        index index.html;

        # Remove Server header — hides nginx version (security best practice)
        more_clear_headers 'Server';

        # Add custom response headers
        more_set_headers 'X-App-Version: 1.0.0';
        more_set_headers 'X-Environment: production';
        more_set_headers 'X-Powered-By: Docker-Demo';
    }
}
```
### Nginx Configuration Explained

| Directive | Value | Meaning |
|---|---|---|
| `load_module` | `ngx_http_headers_more_filter_module.so` | Loads the headers-more module at startup — must be declared before any other block |
| `events {}` | — | Required top-level block in every Nginx config — handles connection processing settings |
| `http {}` | — | Wraps all HTTP server configuration |
| `listen` | `80` | Nginx listens for incoming requests on port 80 |
| `root` | `/usr/share/nginx/html` | Root directory where static files are served from |
| `index` | `index.html` | Default file to serve when a directory is requested |
| `more_clear_headers` | `'Server'` | Removes the `Server` header from all responses — hides nginx version from clients |
| `more_set_headers` | `'X-App-Version: 1.0.0'` | Adds a custom `X-App-Version` header to all responses |
| `more_set_headers` | `'X-Environment: production'` | Adds a custom `X-Environment` header to all responses |
| `more_set_headers` | `'X-Powered-By: Docker-Demo'` | Adds a custom `X-Powered-By` header to all responses |

**How response headers look before and after:**
```bash
# Without headers-more module
curl -I http://localhost:8080
```
```
HTTP/1.1 200 OK
Server: nginx/1.28.2      ← exposes nginx version — security risk ❌
```
```bash
# With headers-more module
curl -I http://localhost:8080
```
```
HTTP/1.1 200 OK
X-App-Version: 1.0.0      ← custom header added ✅
X-Environment: production ← custom header added ✅
X-Powered-By: Docker-Demo ← custom header added ✅
                          ← Server header removed ✅
```

> **Why remove the `Server` header?** Exposing the nginx version allows attackers to look up known vulnerabilities for that specific version. Removing it is a simple security hardening best practice.

**`src/.dockerignore`**
```
*.log
*.tmp
```

---

## Dockerfile.bad — Unoptimized

**create a file , Filename :** `src/Dockerfile.bad`

```dockerfile
# Use nginx:alpine as base — alpine has apk package manager
FROM nginx:alpine

# OCI Labels
LABEL org.opencontainers.image.authors="RSelvanTech"
LABEL org.opencontainers.image.title="Demo: RUN - Unoptimized"

# ❌ Bad practice — separate RUN instructions = separate layers
RUN apk update
RUN apk add nginx-mod-http-headers-more
RUN rm -rf /var/cache/apk/*


#  ✅ COPY after RUN here which is fine for order
COPY nginx/nginx.conf /etc/nginx/nginx.conf
COPY html/ /usr/share/nginx/html/

EXPOSE 80
```

---

## Dockerfile — Optimized

**create a file , Filename :** `src/Dockerfile`

```dockerfile
# Use nginx:alpine as base — alpine has apk package manager
FROM nginx:alpine

# OCI Labels
LABEL org.opencontainers.image.authors="RSelvanTech"
LABEL org.opencontainers.image.title="Demo: RUN - Optimized"
LABEL org.opencontainers.image.description="Nginx with headers-more module"

# ✅ Good practice — single RUN with chained commands = single layer
# apk add --no-cache avoids storing package index inside the image layer
RUN apk update && \
    apk add --no-cache nginx-mod-http-headers-more && \
    rm -rf /var/cache/apk/*

# ✅ Good order — stable config before frequently changing html
COPY nginx/nginx.conf /etc/nginx/nginx.conf
COPY html/ /usr/share/nginx/html/

EXPOSE 80
```

---

## Lab Instructions

### Step 1: Create Project Files

Create all files shown in **Application Files** and **Dockerfiles** listed above.

---

### Step 2: Build Unoptimized Image

```bash
cd 07-dockerfile-run/src

docker build -f Dockerfile.bad -t nginx-headers:bad .
```

---

### Step 3: Build Optimized Image

```bash
docker build -t nginx-headers:good .
```

---

### Step 4: Compare Image Layers with `docker history`
```bash
# Bad image — separate RUN layers
docker history nginx-headers:bad
docker history nginx-headers:bad | wc -l
```
```
CREATED BY                                         SIZE
RUN rm -rf /var/cache/apk/*                        0B      ← deletes files BUT frozen in layer above
RUN apk add nginx-mod-http-headers-more            143kB   ← module files
RUN apk update                                     2.91MB  ← package index cache committed to layer

Total layers: 29
```
```bash
# Good image — single chained RUN layer
docker history nginx-headers:good
docker history nginx-headers:good | wc -l
```
```
CREATED BY                                         SIZE
RUN apk update && apk add --no-cache ...           143kB   ← only module, no cache stored

Total layers: 28
```
```bash
# Compare total image sizes
docker images | grep nginx-headers
```
```
nginx-headers   bad    65.1MB   ❌  29 layers
nginx-headers   good   62.2MB   ✅  28 layers
```

**Why is `good` 2.9MB smaller and 1 layer fewer?**

Two things working together in the optimized Dockerfile:

1. **`apk add --no-cache`** — tells apk not to store the package index inside the layer. The `2.91MB` package index is never written to the layer at all.

2. **`rm -rf /var/cache/apk/*` in the same `RUN`** — any residual cache is cleaned in the same layer before it is committed.

In the bad Dockerfile, `apk update` runs in its own separate layer — the `2.91MB` package index is **committed and frozen** into that layer forever. The `rm` in a later separate layer adds a `0B` deletion entry on top but cannot undo what is already frozen below.
```
bad:   3 RUN layers = 2.91MB (apk update) + 143kB (module) + 0B (rm) = 3.05MB  ❌
good:  1 RUN layer  = 143kB  (all combined, --no-cache)               = 143kB   ✅

Saved: ~2.9MB and 2 fewer layers — confirmed by docker images and wc -l output
```

> **Key insight:** With a small module like `nginx-mod-http-headers-more` the saving is ~2.9MB. With large packages like `nodejs`, `python3`, or `build-base` the package index cache can be hundreds of MB — making `--no-cache` and same-layer cleanup critical for production images.
---

### Step 5-a: Run and Verify Custom Headers

```bash
docker run -d -p 8080:80 --name nginx-headers nginx-headers:good
```

```bash
# Check HTTP response headers
curl -I http://localhost:8080
```

Expected output:
```
HTTP/1.1 200 OK
X-App-Version: 1.0.0         ← custom header added by headers-more ✅
X-Environment: production    ← custom header added by headers-more ✅
X-Powered-By: Docker-Demo    ← custom header added by headers-more ✅
                             ← Server header removed for security ✅
```

Notice the `Server: nginx` header is gone — hiding the server version is a security best practice.

### Step 5-b: Verofy home page in browser

```bash
# Open below URL in browser
http://localhost:8080
```

---

### Step 6: Docker Layer Cache in Action

Run the build again without changing anything:

```bash
docker build -t nginx-headers:good .
```

```
=> CACHED RUN apk update && apk add --no-cache ...    ← cache hit ✅
=> CACHED COPY nginx/nginx.conf /etc/nginx/...        ← cache hit ✅
=> CACHED COPY html/ /usr/share/nginx/html/           ← cache hit ✅
```

All layers served from cache — instant build.

Now change `html/index.html` and rebuild:

```bash
echo "<h1>Updated</h1>" >> html/index.html
docker build -t nginx-headers:good .
```

```
=> CACHED RUN apk update && apk add --no-cache ...    ← cache hit ✅
=> CACHED COPY nginx/nginx.conf /etc/nginx/...        ← cache hit ✅
=> COPY html/ /usr/share/nginx/html/                  ← cache MISS — html changed
```

Only the changed layer and layers below it re-run. `RUN apk add` is still cached — no reinstall needed.

---

### Step 7: Force Rebuild with `--no-cache`

```bash
docker build --no-cache -t nginx-headers:good .
```

```
=> RUN apk update && apk add --no-cache ...           ← runs fresh, no cache
=> COPY nginx/nginx.conf /etc/nginx/...               ← runs fresh, no cache
=> COPY html/ /usr/share/nginx/html/                  ← runs fresh, no cache
```

**When to use `--no-cache`:**
- Package versions may have been updated (`apk update` cached stale index)
- CI/CD pipelines — ensure every build is fresh and reproducible
- Troubleshooting unexplained build issues

---

### Step 8: See Full Build Output with `--progress=plain`

By default Docker shows a condensed build output. Use `--progress=plain` to see every step in full detail:

```bash
docker build --no-cache --progress=plain -t nginx-headers:good . 2>&1
```

```
#1 [internal] load build definition from Dockerfile
#2 [internal] load .dockerignore
#3 [internal] load metadata for nginx:alpine
#4 RUN apk update && apk add --no-cache nginx-mod-http-headers-more ...
#4 0.312 fetch https://dl-cdn.alpinelinux.org/...
#4 1.204 (1/3) Installing ...
#4 2.891 OK: 45 MiB in 28 packages
#5 COPY nginx/nginx.conf /etc/nginx/nginx.conf
#6 COPY html/ /usr/share/nginx/html/
```

Useful for debugging build failures — you can see exactly what each step is doing.

---

### Step 9: Advanced `docker build` Flags Reference

```bash
# Skip layer cache — always rebuild fresh
docker build --no-cache -t nginx-headers:good .

# Pass build arguments
docker build --build-arg APP_ENV=production -t nginx-headers:prod .

# Use a specific Dockerfile
docker build -f Dockerfile.bad -t nginx-headers:bad .

# See full build output
docker build --progress=plain -t nginx-headers:good .

# Combine flags
docker build --no-cache --progress=plain -f Dockerfile.bad -t nginx-headers:bad . 2>&1
```

**Inspect the final image:**
```bash
# See all layers, sizes and commands
docker history nginx-headers:good

# See full image metadata including ENV, CMD, exposed ports
docker image inspect nginx-headers:good
```

---

### Step 10: Cleanup

```bash
docker stop nginx-headers
docker rm nginx-headers
docker rmi nginx-headers:good nginx-headers:bad
```

---

## Key Takeaways

| Concept | Best Practice |
|---|---|
| Multiple packages to install | Chain in single `RUN` with `&&` |
| Cleanup after install | Must be in **same `RUN`** as install |
| `apk add --no-cache` | Avoids storing package index in the image layer |
| Instruction order | Stable/slow things at top, frequently changing at bottom |
| `--no-cache` on `docker build` | Use in CI/CD or when packages may have updated |
| `--progress=plain` | Use when debugging build failures |
| `docker history` | Always check layer sizes after optimizing |

> **Remember:** Cache invalidation cascades downward — one changed layer re-runs everything below it. Instruction order is a performance decision, not just a style choice.