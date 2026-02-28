# Dockerfile ARG, ENV and WORKDIR Instructions

## Overview

This demo covers three Dockerfile instructions that work together to build flexible, well-organized images:

- **`ARG`** — defines build-time variables, passed via `--build-arg` during `docker build`
- **`ENV`** — sets runtime environment variables, persisted in the image and available in the container
- **`WORKDIR`** — sets the working directory for subsequent instructions in the Dockerfile

**Real-world use case:** Build a multi-environment Nginx image where the Nginx version and environment (dev/staging/prod) are controlled at build time, and runtime config is available inside the container via ENV variables.

---

## Key Concepts

### ARG vs ENV — The Critical Difference

| | `ARG` | `ENV` |
|---|---|---|
| **Scope** | Build time only | Build time + Runtime |
| **Available in container** | ❌ Gone after build | ✅ Persisted in image |
| **Override** | `--build-arg` at `docker build` | `-e` at `docker run` |
| **Use case** | Nginx version, build flags | App config, ports, environment name |

```
docker build --build-arg NGINX_IMAGE_TAG=1.27   ← ARG override (build time)
docker run -e APP_ENV=production ...          ← ENV override (run time)
```

### ARG + ENV Combination
A common pattern is to use `ARG` to dynamically set an `ENV` value at build time:

```dockerfile
ARG APP_ENV=dev          # build-time variable
ENV APP_ENV=${APP_ENV}   # promote to runtime variable
```

Now `APP_ENV` is available both during build AND inside the running container.

### WORKDIR
Sets the working directory inside the container for all subsequent `COPY`, `ADD`, `RUN`, `CMD`, and `ENTRYPOINT` instructions.

```dockerfile
WORKDIR /app             # all following instructions work relative to /app
COPY nginx.conf .        # copies to /app/nginx.conf
COPY html/ ./html/       # copies to /app/html/
```

- If `WORKDIR` is not set, the default is `/` (root) — always set it explicitly
- Can be chained: each `WORKDIR` builds on the previous path
- Creates the directory if it does not exist

---

## Project Structure

```
05-dockerfile-arg-env-workdir/
├── src/
│   ├── html/
│   │   └── index.html      # Displays environment info
│   ├── nginx.conf           # Custom nginx config
│   ├── .dockerignore
│   └── Dockerfile
└── README.md
```

---

## Application Files

**`src/html/index.html`**
```html
<!DOCTYPE html>
<html>
<head><title>ARG ENV WORKDIR Demo</title></head>
<body>
  <h1>Nginx - Multi Environment Demo</h1>
  <p>Environment variables set via ENV instruction are available in the container.</p>
  <p>Use <code>docker exec</code> to inspect them.</p>
</body>
</html>
```

**`nginx.conf`**
```nginx
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ =404;
    }
}
```
### Nginx Configuration Explained

| Directive | Value | Meaning |
|---|---|---|
| `listen` | `80` | Nginx listens for incoming requests on port 80 |
| `root` | `/usr/share/nginx/html` | Root directory where static files are served from |
| `index` | `index.html` | Default file to serve when a directory is requested |
| `location /` | — | Applies this block to all incoming request paths |
| `try_files $uri` | — | First try to serve the exact file matching the request path |
| `try_files $uri/` | — | If not found, try it as a directory |
| `=404` | — | If neither found, return a 404 error |

**How a request flows through this config:**
```
You're right. The correct order following `try_files $uri $uri/ =404`:

````markdown
**How a request flows through this config:**

```
Request: GET /about

        │
        ▼
try $uri → /usr/share/nginx/html/about          ← exact file? not found
        │
        ▼
try $uri/ → /usr/share/nginx/html/about/        ← directory with index.html? not found
        │
        ▼
return 404                                      ← nothing matched ❌


Request: GET /index.html

        │
        ▼
try $uri → /usr/share/nginx/html/index.html     ← exact file found, serve it ✅


Request: GET /

        │
        ▼
try $uri → /usr/share/nginx/html/               ← exact file? no, it's a directory
        │
        ▼
try $uri/ → /usr/share/nginx/html/ + index.html ← directory found, serve index.html ✅
```

> This is the standard Nginx config for serving a static website. The `try_files` directive is important — without it, Nginx may not correctly handle requests for files vs directories.

**`.dockerignore`**
```
*.log
*.tmp
```

---

## Dockerfile

```dockerfile
# Use nginx:alpine-slim as base Docker Image
# ARG defined before FROM is available only in FROM — not in the rest of Dockerfile
ARG NGINX_IMAGE_TAG=1.27-alpine-slim

FROM nginx:${NGINX_IMAGE_TAG}

# OCI Labels
LABEL org.opencontainers.image.authors="RSelvanTech"
LABEL org.opencontainers.image.title="Demo: ARG + ENV + WORKDIR"
LABEL org.opencontainers.image.description="Multi-environment Nginx demo"

# ARG defined after FROM — available during build for RUN, COPY, ENV etc.
ARG APP_ENV=dev
ARG APP_VERSION=1.0.0

# ENV — promote ARG values to runtime environment variables
# Single line with multiple key=value pairs (best practice — saves one image layer)
ENV APP_ENV=${APP_ENV} \
    APP_VERSION=${APP_VERSION} \
    APP_PORT=80 \
    NGINX_WORKER_PROCESSES=auto

# WORKDIR — set working directory for all following instructions
# Creates /app directory if it does not exist
WORKDIR /app

# Copy files relative to WORKDIR — no need to specify full paths
COPY nginx.conf ./nginx.conf
COPY html/ ./html/

# Copy nginx config from WORKDIR to nginx config directory
RUN cp ./nginx.conf /etc/nginx/conf.d/default.conf && \
    cp -r ./html/. /usr/share/nginx/html/

# EXPOSE the port nginx listens on
EXPOSE 80
```

> **Note on ARG before FROM:** An `ARG` defined before `FROM` can only be used in the `FROM` instruction. To use it in the rest of the Dockerfile, redefine it after `FROM`.

---

## Lab Instructions

### Step 1: Create Project Files

Create all files as shown in **Application Files** above.

---

### Step 2: Build with Default ARG Values

```bash
docker build -t nginx-multienv:dev .
```

This uses the default values defined in the Dockerfile:
- `NGINX_IMAGE_TAG=1.27`
- `APP_ENV=dev`
- `APP_VERSION=1.0.0`

---

### Step 3: Inspect ARG vs ENV — The Key Difference

```bash
# Inspect ENV variables baked into the image
docker inspect nginx-multienv:dev | grep -A 20 '"Env"'
```

Expected output:
```json
"Env": [
    "APP_ENV=dev",
    "APP_VERSION=1.0.0",
    "APP_PORT=80",
    "NGINX_WORKER_PROCESSES=auto"
]
```

ENV variables are persisted in the image — visible here. ARG values (`NGINX_IMAGE_TAG`) are **not** present — they are gone after the build.

```bash
# Verify ENV inside a running container
docker run --rm nginx-multienv:dev env | grep APP
```
```
APP_ENV=dev
APP_VERSION=1.0.0
APP_PORT=80
```

---

### Step 4: Build with Custom ARG Values (prod environment)

```bash
docker build \
  --build-arg APP_ENV=production \
  --build-arg APP_VERSION=2.0.0 \
  --build-arg NGINX_IMAGE_TAG=1.27-alpine-slim \
  -t nginx-multienv:prod .
```

Verify the prod image has different ENV values:
```bash
docker inspect nginx-multienv:prod | grep -A 20 '"Env"'
```
```json
"Env": [
    "APP_ENV=production",
    "APP_VERSION=2.0.0",
    "APP_PORT=80",
    "NGINX_WORKER_PROCESSES=auto"
]
```

Same Dockerfile, different image for each environment — controlled entirely by `--build-arg`.

---

### Step 5: Verify WORKDIR

```bash
# Run a container and check the working directory
docker run --rm nginx-multienv:dev pwd
```
```
/app
```

```bash
# List files in WORKDIR
docker run --rm nginx-multienv:dev ls -laR
```
```
drwxr-xr-x  nginx.conf
drwxr-xr-x  html/
```

Files are organized under `/app` as set by `WORKDIR`.

---

### Step 6: Run and Test

```bash
# Run dev image
docker run -d -p 8080:80 --name nginx-dev nginx-multienv:dev

# Run prod image
docker run -d -p 8081:80 --name nginx-prod nginx-multienv:prod
```

Access both:
- Dev: `http://localhost:8080`
- Prod: `http://localhost:8081`

Verify ENV inside each running container:
```bash
docker exec nginx-dev env | grep APP
docker exec nginx-prod env | grep APP
```
```
# dev container
APP_ENV=dev
APP_VERSION=1.0.0

# prod container
APP_ENV=production
APP_VERSION=2.0.0
```

---

### Step 7: Override ENV at Runtime

`ENV` values set at build time can be overridden at `docker run` with `-e`:

```bash
docker run --rm -e APP_ENV=staging nginx-multienv:dev env | grep APP
```
```
APP_ENV=staging       ← overridden at runtime ✅
APP_VERSION=1.0.0     ← still from build time
APP_PORT=80
```

---

### Step 8: Image Layers — ENV Optimization

Every instruction in a Dockerfile creates a new image layer. Bad practice — 3 separate `ENV` instructions = 3 layers:

```dockerfile
# ❌ Bad — 3 separate layers
ENV APP_ENV=dev
ENV APP_VERSION=1.0.0
ENV APP_PORT=80
```

Good practice — single `ENV` with multiple key=value pairs = 1 layer:

```dockerfile
# ✅ Good — 1 layer
ENV APP_ENV=dev \
    APP_VERSION=1.0.0 \
    APP_PORT=80
```
---

### Step 9: Cleanup

```bash
docker stop nginx-dev nginx-prod
docker rm nginx-dev nginx-prod
docker rmi nginx-multienv:dev nginx-multienv:prod
```

---

## Key Takeaways

| Instruction | Scope | Override | Use Case |
|---|---|---|---|
| `ARG` | Build time only | `--build-arg` at `docker build` | Nginx version, build flags, env name |
| `ENV` | Build + Runtime | `-e` at `docker run` | App config, ports, feature flags |
| `ARG` + `ENV` combo | Build → Runtime | `--build-arg` promotes to ENV | Dynamic runtime config from build args |
| `WORKDIR` | Build + Runtime | N/A | Organizes files, sets default directory |

> **Best Practices:**
> - Always set `WORKDIR` explicitly — never rely on root `/` as default
> - Use single-line `ENV` with multiple key=value pairs to minimize image layers
> - Use `ARG` + `ENV` combination when you need build-time flexibility with runtime availability
> - Never put secrets in `ARG` or `ENV` — they are visible in `docker inspect`