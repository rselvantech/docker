# Docker Compose Build — `build:` Key + `--build` Flag

## Overview

So far all compose demos have used pre-built images pulled from Docker Hub. In real projects you often need to build your own image from a Dockerfile and run it with Compose. This demo covers the `build:` key in `compose.yaml` and the `--build` flag that forces a rebuild.

**What you'll learn:**
- `build:` key — `context:`, `dockerfile:`, `args:`
- `image:` alongside `build:` — name the built image
- `docker compose build` — build without starting
- `docker compose up --build` — build and start in one step
- `docker compose up` (no flag) — reuses cached image
- `--no-cache` — force full rebuild ignoring cache
- When to rebuild vs reuse
- Layer caching — how Compose avoids unnecessary rebuilds

---

## Project Structure

```
13-docker-compose-build/
├── src/
│   ├── app/
│   │   ├── index.html     # static site content
│   │   ├── nginx.conf     # custom Nginx config
│   │   └── Dockerfile
│   └── compose.yaml
└── README.md
```

A simple Nginx-based static site — custom `index.html` served via a custom `nginx.conf`. Focus stays on the Compose build concepts, not the app.

---

## Application Files

**`src/app/index.html`**
```html
<!DOCTYPE html>
<html>
  <head><title>Compose Build Demo</title></head>
  <body>
    <h1>Hello from Docker Compose Build!</h1>
    <p>This page is served by a custom Nginx image built by Compose.</p>
  </body>
</html>
```

**`src/app/nginx.conf`**
```nginx
server {
    listen 80;
    location / {
        root /usr/share/nginx/html;
        index index.html;
    }
}
```

**`src/app/Dockerfile`**
```dockerfile
FROM nginx:1.29-alpine

# Copy custom Nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy static site content
COPY index.html /usr/share/nginx/html/index.html

EXPOSE 80
```

---

## `compose.yaml`

**`src/compose.yaml`**

```yaml
name: buildemo

services:
  web:
    build:
      context: ./app        # directory containing the Dockerfile and source files
      dockerfile: Dockerfile # optional — defaults to 'Dockerfile' if omitted
    image: buildemo-web:latest  # name to tag the built image
    container_name: buildemo-web
    ports:
      - "8080:80"
    restart: unless-stopped
```

---

## `build:` Key Explained

```yaml
build:
  context: ./app
```

`context` is the directory sent to the Docker builder. Everything inside it is available during the build — COPY and ADD instructions reference files relative to this path.

```
build:
  context: ./app        ← builder gets access to everything inside ./app
  dockerfile: Dockerfile ← which Dockerfile to use (default: Dockerfile in context)
```

```yaml
image: buildemo-web:latest
```

When `build:` and `image:` are both set:
- `image:` names and tags the built image
- Without `image:`, Compose auto-names it as `<project>_<service>` e.g. `buildemo_web`
- With `image:`, the named image is also available via `docker images`

**Optional `args:`** — pass build-time variables to `ARG` in Dockerfile:

```yaml
build:
  context: ./app
  args:
    APP_VERSION: "1.0"     # available as ARG APP_VERSION in Dockerfile
    ENV_NAME: production
```

---

## Lab Instructions

### Step 1: Create Project Files

```bash
mkdir -p 13-docker-compose-build/src/app
cd 13-docker-compose-build/src
```

Create all files as shown above.

---

### Step 2: Build Only (without starting)

```bash
docker compose build
```
```
[+] Building 3.2s (8/8) FINISHED
 => [internal] load build definition from Dockerfile         0.0s
 => [internal] load build context                            0.1s
 => [1/2] FROM nginx:alpine                                  1.8s
 => [2/2] COPY nginx.conf /etc/nginx/conf.d/default.conf     0.1s
 => [3/2] COPY index.html /usr/share/nginx/html/index.html   0.1s
 => exporting to image                                       0.2s
 => naming to buildemo-web:latest                            0.0s
```

`docker compose build` builds the image without creating or starting any containers. Useful to pre-build before deploying, or to verify the build succeeds.

```bash
# Verify the image was created and tagged
docker images buildemo-web
```
```
REPOSITORY     TAG       IMAGE ID       CREATED         SIZE
buildemo-web   latest    a1b2c3d4e5f6   5 seconds ago   43MB
```

---

### Step 3: Start Using the Built Image

```bash
docker compose up -d
```
```
[+] Running 2/2
 ✔ Network buildemo_default   Created
 ✔ Container buildemo-web     Started
```

Notice — **no build step** in this output. Compose reuses the image built in Step 2. This is the expected behavior: `docker compose up` without `--build` reuses the existing image.

```bash
# Verify
curl http://localhost:8080
```
```html
<!DOCTYPE html>
...Hello from Docker Compose Build!...
```

---

### Step 4: Modify the App and Rebuild

Edit `src/app/index.html` — change the heading:

```html
<h1>Hello from Docker Compose Build — v2!</h1>
```

Now run `docker compose up -d` again without `--build`:

```bash
docker compose up -d
```

Refresh `http://localhost:8080` — **old content still shows**. Why? Compose reused the cached image. The file change on your host has no effect until you rebuild.

Now rebuild and restart:

```bash
docker compose up -d --build
```
```
[+] Building 1.1s (8/8) FINISHED
 => CACHED [1/3] FROM nginx:alpine                           0.0s  ← layer cached ✅
 => [2/3] COPY nginx.conf ...                                0.1s
 => [3/3] COPY index.html ...                                0.1s  ← rebuilt ✅
 => naming to buildemo-web:latest
[+] Running 1/1
 ✔ Container buildemo-web     Started
```

Refresh `http://localhost:8080` — **new content shows** ✅

**`--build` flag does two things in one command:**
1. Rebuilds the image (only changed layers, rest from cache)
2. Recreates the container using the new image

```
docker compose up -d          → reuses existing image — fast, no rebuild
docker compose up -d --build  → rebuilds image first, then starts — use after code changes
docker compose build          → builds only, does not start containers
```

---

### Step 5: Understand Layer Caching

The Dockerfile has three steps — `FROM`, `COPY nginx.conf`, `COPY index.html`. When you only changed `index.html`:

```
[1/3] FROM nginx:alpine          → CACHED ✅ base image unchanged
[2/3] COPY nginx.conf            → CACHED ✅ nginx.conf unchanged
[3/3] COPY index.html            → rebuilt  ✅ file changed — cache invalidated here
```

Docker rebuilds only from the changed layer onwards. This is why build order in a Dockerfile matters — put things that change least (base image, dependencies) early, things that change most (source code) late.

---

### Step 6: Force Full Rebuild — `--no-cache`

To rebuild every layer from scratch ignoring cache:

```bash
docker compose build --no-cache
```
```
[+] Building 4.8s (8/8) FINISHED
 => [1/3] FROM nginx:alpine          2.1s  ← re-pulled, not cached
 => [2/3] COPY nginx.conf            0.1s  ← rebuilt
 => [3/3] COPY index.html            0.1s  ← rebuilt
```

When to use `--no-cache`:
```
Suspecting stale cache causing unexpected behavior
After updating base image (e.g. nginx:alpine released a security patch)
Clean build for CI/CD pipelines to ensure reproducibility
```

---

### Step 7: Standalone `docker compose build` Commands

```bash
# Build all services
docker compose build

# Build a specific service only
docker compose build web

# Build with no cache
docker compose build --no-cache

# Build and pull latest base images
docker compose build --pull
```

### Step 8: `Build cache` vs `Image cache`

```
Build cache                          Image cache (local image store)
────────────────────────────────     ────────────────────────────────
Stores intermediate build layers     Stores pulled images
Used to skip unchanged Dockerfile    Used to avoid re-pulling from registry
steps during docker build            when image already exists locally

--no-cache clears THIS               --pull refreshes THIS
```

**When you run FROM nginx:alpine in a Dockerfile:**
```
Docker checks image cache:
  nginx:alpine exists locally? → use it    ← --pull overrides this
  nginx:alpine missing?        → pull it

Docker checks build cache:
  Layer with same instruction + same inputs cached? → use it   ← --no-cache overrides this
  Not cached?                                        → rebuild

```
**So --no-cache tells Docker:**
"Don't reuse any previously built layers — rebuild every Dockerfile instruction from scratch. But the base image itself (FROM nginx:alpine)?
 Use whatever you already have locally."

 **Combined — `--no-cache` `--pull` — pulls latest base image AND rebuilds all layers:**
 ```
 docker compose build --no-cache --pull
 ```


---

### Step 8: Cleanup

```bash
docker compose down

# Remove the built image too
docker rmi buildemo-web:latest
```

---

## `build:` vs `image:` — When to Use Each

| Situation | Use |
|---|---|
| Running pre-built official image (MySQL, Nginx, WordPress) | `image:` only |
| Building your own app from source | `build:` + optional `image:` |
| Building AND naming the image for reuse | `build:` + `image:` together |

```yaml
# image: only — pull from Docker Hub
db:
  image: mysql:8.4

# build: only — build from local Dockerfile, auto-named by Compose
web:
  build:
    context: ./app

# build: + image: — build locally AND name the result
web:
  build:
    context: ./app
  image: myapp-web:latest    # built image tagged as myapp-web:latest
```

---

## Key Takeaways

| Concept | Key Point |
|---|---|
| `build: context:` | Directory sent to builder — all COPY/ADD paths are relative to this |
| `build: dockerfile:` | Optional — defaults to `Dockerfile` in the context directory |
| `image:` with `build:` | Names the built image — without it Compose auto-names as `<project>_<service>` |
| `build: args:` | Pass build-time variables to `ARG` in Dockerfile |
| `docker compose build` | Builds image only — does not start containers |
| `docker compose up -d` | Reuses existing image — does NOT rebuild |
| `docker compose up -d --build` | Rebuilds image first, then starts — use after code changes |
| `docker compose build --no-cache` | Full rebuild ignoring all cached layers |
| `docker compose build --pull` | Pulls latest version of base images before building |
| Layer caching | Layers are rebuilt from the first changed layer downward — put stable layers first |