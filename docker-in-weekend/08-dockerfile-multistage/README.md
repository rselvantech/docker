# Dockerfile Multi-Stage Builds

## Overview

This demo covers multi-stage builds in Docker — a technique that uses multiple `FROM` instructions in a single Dockerfile to produce a small, clean final image by leaving behind all build tools and intermediate files.

**Real-world use case:** Minify a static website using `html-minifier` (Node.js tool), then serve only the minified output using a lightweight Nginx image — leaving the entire Node.js ecosystem behind.

**What you'll learn:**
- What multi-stage builds are and why they matter
- How a JS build process works and how its output is used by Nginx
- How to define and name stages
- `COPY --from` to copy artifacts between stages
- Image size comparison — single stage vs multi-stage
- How `docker history` reveals what each stage contributes

---

## How a JS Build Process Works with Nginx

Understanding the full flow before looking at any Dockerfile:

```
Source Files                Build Stage               Production Output
────────────────            ───────────────           ─────────────────
app/
└── index.html    ──►  html-minifier  ──►  dist/
    (includes          (minify HTML,       └── index.html  (minified)
     inline CSS   ──►   inline CSS,                │
     inline JS)         inline JS)                 ▼
                                           Nginx serves from
                                           /usr/share/nginx/html/
                                           └── index.html
```

**Why minify?**
- Removes whitespace, comments, shortens variable names
- Reduces file sizes — faster page loads
- Standard production practice for all web apps

**Why not run Node.js in production?**
- Node.js + npm + node_modules = ~200MB just to serve static files
- Nginx can serve static files with ~20MB footprint
- Static files don't need Node.js at runtime — only at build time

**The multi-stage solution:**
```
Stage 1 (builder)                    Stage 2 (final)
─────────────────                    ───────────────
node:alpine (~180MB)                 nginx:alpine-slim (~11MB)
+ npm install html-minifier          + dist/ files only
+ source files                       
+ node_modules (~50MB)  ── discarded ──►  COPY --from=builder /app/dist
= ~350MB total                       = ~12MB total ✅
```

---

## The Problem — Single Stage Builds Are Bloated

Without multi-stage builds, everything ends up in the final image:

```
node:alpine base        ~180MB
+ node_modules          ~50MB
+ html-minifier         ~5MB
+ source files          ~1KB
= Final image           ~235MB   ❌ way too large for serving static files
```

With multi-stage builds:
```
Stage 1 (builder)       ~235MB  ← discarded after build
Stage 2 (nginx final)    ~12MB  ← only minified files + nginx ✅
```

---

## How Multi-Stage Builds Work

```dockerfile
# Stage 1 — builder
FROM node:alpine AS builder        # named stage: "builder"
WORKDIR /app
COPY package*.json .
RUN npm install                    # installs html-minifier + deps (~50MB)
COPY app/ ./app/
RUN npm run build                  # minifies files → output goes to /app/dist

# Stage 2 — final
FROM nginx:alpine-slim AS final    # fresh start — nothing from Stage 1 carries over
COPY --from=builder /app/dist /usr/share/nginx/html   # copy ONLY minified output
COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf
```

**Key points:**
- Each `FROM` starts a completely fresh layer — nothing carries over automatically
- `COPY --from=builder` pulls only what you specify from the previous stage
- All build tools, `node_modules`, source files stay in Stage 1 and are discarded
- Only the final stage produces the image when you run `docker build`

---

## Project Structure

```
08-dockerfile-multistage/
├── src/
│   ├── app/
│   │   └── index.html          # Source HTML with inline CSS and JS
│   ├── nginx/
│   │   └── nginx.conf          # Nginx config
│   ├── package.json            # Node build config
│   ├── .dockerignore
│   ├── Dockerfile.single       # Single stage — bloated image
│   └── Dockerfile              # Multi-stage — optimized image
└── README.md
```

---

## Application Files

**`src/app/index.html`** — single file with inline CSS and JS:
```html
<!DOCTYPE html>
<html lang="en">
<head>
    <!-- ==========================================
         Multi-Stage Build Demo - Page Header
         Author: RSelvanTech
         Version: 1.0.0
    ========================================== -->
    <title>Multi-Stage Build Demo</title>

    <!-- Inline styles -->
    <style>
        /* Main body styles */
        body {
            font-family: Arial, sans-serif;
            background: #f0f8ff;
            text-align: center;
            padding: 50px;
        }

        /* Heading styles */
        h1 {
            color: #2c3e50;
            margin-bottom: 20px;
        }

        /* Message styles */
        #message {
            color: #27ae60;
            font-weight: bold;
            margin-top: 20px;
        }
    </style>

</head>
<body>

    <!-- ==========================================
         Main Content Section
    ========================================== -->
    <div class="container">

        <!-- Page heading -->
        <h1>
            Multi-Stage Build Demo
        </h1>

        <!-- Description paragraphs -->
        <p>
            This page was minified by Node.js html-minifier in Stage 1.
        </p>

        <p>
            It is now served by a lightweight Nginx image in Stage 2.
        </p>

        <!-- Dynamic message placeholder -->
        <p id="message"></p>

    </div>
    <!-- End of main content -->

    <!-- ==========================================
         Inline JavaScript
    ========================================== -->
    <script>
        // Display build info message
        document.getElementById('message').textContent =
            'Built with Node.js html-minifier, served with Nginx — Multi-Stage Docker Build!';

        // Log build info to console
        console.log('App loaded successfully');
        console.log('Build tool: html-minifier');
        console.log('Server: Nginx alpine-slim');
    </script>

</body>
</html>
```

**`src/nginx/nginx.conf`**
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

**`src/package.json`**
```json
{
  "name": "multistage-demo",
  "version": "1.0.0",
  "scripts": {
    "build": "mkdir -p dist && html-minifier --collapse-whitespace --remove-comments --minify-css true --minify-js true -o dist/index.html app/index.html"
  },
  "devDependencies": {
    "html-minifier": "^4.0.0"
  }
}
```

**`src/.dockerignore`**
```
node_modules/
*.log
*.tmp
.git
```

> **Important:** `node_modules/` must be in `.dockerignore` — this prevents your local `node_modules` from being sent to the build context. Docker will install them fresh inside the container via `npm install`.

---

## `package.json` build script explained:**

```json
{
...
...
  "scripts": {
    "build": "mkdir -p dist && html-minifier --collapse-whitespace --remove-comments --minify-css true --minify-js true -o dist/index.html app/index.html"
  },
...
...
}
```

```bash
mkdir -p dist
```
Creates the `dist/` output directory if it does not exist.

```bash
html-minifier \
  --collapse-whitespace \    # removes unnecessary whitespace between HTML tags
  --remove-comments \        # strips all HTML comments
  --minify-css true \        # minifies CSS inside <style> tags
  --minify-js true \         # minifies JS inside <script> tags
  -o dist/index.html \       # output destination
  app/index.html             # input source file
```

Since CSS and JS are inlined inside `index.html`, all four flags do real work — whitespace, comments, CSS and JS are all minified into a single `dist/index.html`.

**Full `dist/` output after build:**
```
dist/
└── index.html   ← minified — HTML, CSS and JS all compacted into one file
```


## Nginx Configuration Explained

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

| Directive | Value | Meaning |
|---|---|---|
| `listen` | `80` | Nginx listens for incoming requests on port 80 |
| `root` | `/usr/share/nginx/html` | Root directory where static files are served from — this is where `COPY --from=builder /app/dist` puts the files |
| `index` | `index.html` | Default file to serve when a directory is requested |
| `location /` | — | Catch-all — applies to all incoming request paths |
| `try_files $uri` | — | First try to serve the exact file matching the request path |
| `try_files $uri/` | — | If not found, try it as a directory |
| `=404` | — | If neither found, return a 404 error |

**How a request flows:**

```
Request: GET /index.html
        │
        ▼
try $uri → /usr/share/nginx/html/index.html    ← exact file found, serve it ✅

Request: GET /
        │
        ▼
try $uri → /usr/share/nginx/html/              ← exact file? no, it's a directory
        │
        ▼
try $uri/ → /usr/share/nginx/html/ + index.html ← directory found, serve index.html ✅

Request: GET /about
        │
        ▼
try $uri → /usr/share/nginx/html/about         ← exact file? not found
        │
        ▼
try $uri/ → /usr/share/nginx/html/about/       ← directory? not found
        │
        ▼
return 404                                     ← nothing matched ❌
```

**How the build output connects to Nginx:**

```
Stage 1 builds:              Stage 2 copies to nginx root:
/app/dist/                   /usr/share/nginx/html/
└── index.html   ──────────► └── index.html   (served at /)
```

---

## Dockerfile.single — Single Stage (Bloated)

**create a file , Filename :** `src/Dockerfile.single`

```dockerfile
# Single stage — build tools and node_modules stay in the image
FROM node:alpine

# OCI Labels
LABEL org.opencontainers.image.authors="RSelvanTech"
LABEL org.opencontainers.image.title="Demo: Single Stage - Bloated"

WORKDIR /app

# Install dependencies
COPY package*.json .
RUN npm install

# Copy source and build
COPY app/ ./app/
RUN npm run build

# Install nginx and create required directories
RUN apk add --no-cache nginx && \
    mkdir -p /etc/nginx/conf.d && \
    mkdir -p /usr/share/nginx/html

COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf

# Copy minified output to nginx web root
RUN cp /app/dist/index.html /usr/share/nginx/html/index.html

EXPOSE 80

# Run nginx in foreground — keeps container alive
CMD ["nginx", "-g", "daemon off;"]
```

---

## Dockerfile — Multi-Stage (Optimized)

**create a file , Filename :** `src/Dockerfile`

```dockerfile
# ──────────────────────────────────────────
# Stage 1: Builder — install tools and build
# ──────────────────────────────────────────
FROM node:alpine AS builder

LABEL org.opencontainers.image.authors="RSelvanTech"

WORKDIR /app

# Install html-minifier
COPY package*.json .
RUN npm install

# Copy source files and minify
COPY app/ ./app/
RUN npm run build
# Minified output is now in /app/dist/index.html

# ──────────────────────────────────────────
# Stage 2: Final — clean nginx image
# ──────────────────────────────────────────
FROM nginx:alpine-slim AS final

LABEL org.opencontainers.image.authors="RSelvanTech"
LABEL org.opencontainers.image.title="Demo: Multi-Stage Build"
LABEL org.opencontainers.image.description="Static site minified with Node.js, served with Nginx"

# Copy ONLY the minified output from Stage 1
# node, npm, node_modules, source files are all left behind
COPY --from=builder /app/dist/index.html /usr/share/nginx/html/index.html

# Copy nginx config
COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

# Run nginx in foreground — keeps container alive
CMD ["nginx", "-g", "daemon off;"]
```

---

## Lab Instructions

### Step 1: Create Project Files

Create all files shown in **Application Files** and **Dockerfiles** listed above.

---

### Step 2: Build Single Stage Image

```bash
cd 08-dockerfile-multistage/src

docker build -f Dockerfile.single -t webapp:single .
```

---

### Step 3: Build Multi-Stage Image

```bash
docker build -t webapp:multi .
```

Watch the output — you will see both stages execute:
```
=> [builder 1/4] FROM docker.io/library/node:alpine       ← Stage 1 starts
=> [builder 2/4] COPY package*.json .
=> [builder 3/4] RUN npm install                          ← installs html-minifier
=> [builder 4/4] RUN npm run build                        ← minifies files to /app/dist
=> [final 1/3] FROM docker.io/library/nginx:alpine-slim   ← Stage 2 starts (fresh)
=> [final 2/3] COPY --from=builder /app/dist ...          ← copies only minified output
=> [final 3/3] COPY nginx/nginx.conf ...
```

---

### Step 4: Compare Image Sizes

```bash
docker images | grep webapp
```

```
REPOSITORY   TAG       SIZE
webapp       single    ~179MB   ← node + npm + node_modules + source ❌
webapp       multi      ~12.7MB   ← nginx + minified files only ✅
```

The multi-stage image is a fraction of the size — all build tools are gone.

---

### Step 5: Verify Minification Worked

```bash
# Run the builder stage temporarily to compare file sizes
docker run --rm webapp:single sh -c "wc -c /app/app/index.html && wc -c /app/dist/index.html"
```

```
1969   /app/app/index.html    ← original with whitespace and comments
769   /app/dist/index.html   ← minified — ~50% smaller ✅
```

---

### Step 6: Verify Build Tools are Gone from Final Image

```bash
# node is NOT present in the final image
docker run --rm webapp:multi node --version
```
```
/docker-entrypoint.sh: exec: line 47: node: not found   ✅
```

```bash
# npm is NOT present in the final image
docker run --rm webapp:multi npm --version
```
```
/docker-entrypoint.sh: exec: line 47: npm: not found    ✅
```

```bash
# Only the minified file is present
docker run --rm webapp:multi ls -l /usr/share/nginx/html/
```
```
index.html   ✅ single minified file — HTML, CSS and JS all inlined
```

---

### Step 7: Run and Test

```bash
docker run -d -p 8080:80 --name webapp webapp:multi
```

Open in browser: `http://localhost:8080`

View page source — notice the HTML has no whitespace or comments — proof that minification worked.

---

### Step 8: Inspect Layers with `docker history`

```bash
# Single stage — many layers including node runtime
docker history webapp:single
docker history webapp:single | wc -l
```
```
CREATED BY                                    SIZE
RUN /bin/sh -c cp /app/dist/index.html ...    769B
COPY nginx/nginx.conf ...                     139B
RUN apk add --no-cache nginx                  2.01MB
RUN npm run build                             4.29kB
COPY app/ ./app/                              1.97kB
RUN npm install                               7.08MB    ← node_modules in image!
COPY package*.json .                          286B
node:alpine base                              8.44MB  ← full node runtime
Total layers: ~21 total layers (12 ours + 9 from node:alpine base)
```

```bash
# Multi-stage — minimal layers
docker history webapp:multi
docker history webapp:multi | wc -l
```
```
CREATED BY                                    SIZE
COPY nginx/nginx.conf ...                     139B
COPY --from=builder /app/dist ...             769B   ← only minified output
nginx:alpine-slim base                        8.44B   ← tiny base
Total layers: ~23 total layers (7 ours + 16 from nginx:alpine-slim base)
```

---

### Step 9: Cleanup

```bash
docker stop webapp
docker rm webapp
docker rmi webapp:single webapp:multi
```

---

## Key Takeaways

| | Single Stage | Multi-Stage |
|---|---|---|
| **Image size** | ~179MB | ~12MB |
| **Node.js in image** | ✅ Present | ❌ Gone |
| **node_modules in image** | ✅ Present (~50MB) | ❌ Gone |
| **Source files in image** | ✅ Present | ❌ Gone |
| **Minified output** | ✅ Present | ✅ Present |
| **Security surface** | Large | Minimal |
| **Production ready** | ❌ | ✅ |

> **Best Practices:**
> - Always use multi-stage builds for compiled or built applications
> - Name your stages clearly — `AS builder`, `AS final`
> - Use the smallest possible base image for the final stage (`alpine-slim`, `distroless`)
> - Only `COPY --from` what is absolutely needed in the final image
> - Always add `node_modules/` to `.dockerignore` — Stage 1 installs them fresh inside the container
