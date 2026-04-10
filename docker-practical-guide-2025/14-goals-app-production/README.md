# Docker Compose - Production-Ready Multi-Container Goals Application Lab 

## Lab Overview

Demo-13 built a working three-tier Goals App using Docker Compose. That setup was
optimised for **development** — a live-reload React dev server, bind-mounted source
code, and nodemon for instant backend restarts. Those features are invaluable during
development. They are completely wrong for production.

This demo takes the same Goals App and makes it genuinely production-ready:

- **Frontend:** Multi-stage build — Node compiles React to static files, nginx
  serves them. Result: a ~25MB image instead of a ~400MB dev image.
- **Backend:** Production build — no nodemon, no bind mounts, code baked in.
- **nginx as API proxy:** The frontend nginx server proxies `/goals` API calls
  to the backend — solving a fundamental problem with how browsers communicate
  with backends across different environments.
- **Configurable via env vars:** Every environment-specific value (MongoDB
  hostname, database name, backend hostname) is an environment variable with a
  sensible default. The same images run in Docker Compose, Kubernetes, or any
  cloud environment by changing only env vars — no image rebuilds.

**What you'll learn:**
- Why the React dev server is unsuitable for production — and what replaces it
- How multi-stage Docker builds work and why they produce smaller, safer images
- How nginx serves static files and proxies API requests simultaneously
- Why browser-side API calls cannot use container-internal hostnames
- How `envsubst` in the nginx Docker image enables runtime configuration
- How to make any hardcoded value configurable via environment variables
- The standard build → test → push workflow for production images

**What you'll do:**
- Understand the browser vs server URL problem (why `http://localhost` breaks)
- Change `App.js` to use a relative API URL (`/goals` instead of `http://localhost/goals`)
- Write an `nginx.conf` that serves the React build and proxies API calls
- Write multi-stage Dockerfiles for both frontend and backend
- Make MongoDB hostname and database name configurable in the backend
- Update `docker-compose.yaml` to use the new production images
- Test the full application with Docker Compose
- Build and push production images to Docker Hub

---

## Prerequisites

- ✅ Completed Demo-13 — Goals App running with Docker Compose
- ✅ Source code available from Demo-13 (`src/backend/` and `src/frontend/`)
- ✅ Docker installed and running
- ✅ Docker Hub account with write access
- ✅ Logged in: `docker login --username rselvantech`

**Verify:**
```bash
docker compose version
docker info | grep "Server Version"
```

**Expected:**
```text
Docker Compose version v2.39.x
Server Version: 28.4.x
```

---

## How this Demo Solution Works — Docker Compose

### Modules and How They Interwork

The Goals App has three services running as Docker containers on a single
Docker network called `goals_default` (created automatically by Compose):

```
┌─────────────────────────────────────────────────────────────────┐
│  Docker network: goals_default                                  │
│                                                                 │
│  ┌──────────────────┐    ┌──────────────────┐    ┌───────────┐  │
│  │   goals-frontend │    │  goals-backend   │    │  mongodb  │  │
│  │   nginx:1.25     │    │  node:18-alpine  │    │  mongo:6  │  │
│  │   port 3000      │    │  port 80         │    │  port     │  │
│  │                  │──▶│                  │───▶│  27017    │  │
│  │  static files    │    │  REST API        │    │           │  │
│  │  + API proxy     │    │  /goals CRUD     │    │  data     │  │
│  └──────────────────┘    └──────────────────┘    │  volume   │  │
│          │                                       └───────────┘  │
└──────────┼──────────────────────────────────────────────────────┘
           │ port 3000 published to host
           ▼
      Your laptop
      http://localhost:3000
```

**Docker Compose network and DNS:**
Every service in a Compose file is automatically reachable by its service name
as a DNS hostname within the `goals_default` network. Docker runs an internal
DNS server at `127.0.0.11` inside every container. When nginx resolves
`backend`, it queries `127.0.0.11` which returns the backend container's IP.

```
Container: goals-frontend-1
  /etc/resolv.conf:
    nameserver 127.0.0.11
    search goals_default.example.com

nginx resolves "backend":
  → queries 127.0.0.11
  → Docker DNS returns 172.18.0.3 (backend container IP)
  → nginx connects to 172.18.0.3:80
```

---

### nginx's Dual Role — Static File Server and API Proxy

nginx inside the frontend container does two completely different jobs
simultaneously, determined by the URL path of each incoming request:

```
Incoming request
       │
       ▼
nginx (port 3000)
       │
       ├── path starts with /goals ──▶ API Proxy ──▶ backend:80
       │
       └── everything else ──────────▶ Static File Server
                                        /usr/share/nginx/html/
```

**Role 1 — Static File Server (`location /`):**

The React build output — `index.html`, JavaScript bundles, CSS, images — was
compiled by Node.js during `docker build` and copied into the nginx image at
`/usr/share/nginx/html/`. nginx serves these files directly from disk:

```
GET /                    → /usr/share/nginx/html/index.html
GET /static/js/main.js   → /usr/share/nginx/html/static/js/main.js
GET /static/css/main.css → /usr/share/nginx/html/static/css/main.css
GET /favicon.ico         → /usr/share/nginx/html/favicon.ico
```

`try_files $uri $uri/ /index.html` handles React Router — any URL that is not
a real file on disk (e.g. `/about`, `/dashboard`) returns `index.html` so
React handles the routing client-side.

**Role 2 — API Proxy (`location /goals`):**

The React JavaScript, once loaded in the browser, calls `/goals` as a relative
URL. The browser sends this to the same host and port it loaded the page from
(`localhost:3000`). nginx intercepts it and forwards it to the backend:

```
GET /goals      → proxy_pass http://backend:80/goals
POST /goals     → proxy_pass http://backend:80/goals
DELETE /goals/x → proxy_pass http://backend:80/goals/x
```

The backend receives the request, processes it, and returns a JSON response.
nginx passes the response back to the browser. The browser never communicates
directly with the backend — nginx is the intermediary.

---

### How `${BACKEND_HOST}` Works at Container Start

`BACKEND_HOST=backend` is set in `docker-compose.yaml`. When the frontend
container starts, the nginx Docker image automatically runs `envsubst` on
every file in `/etc/nginx/templates/`, replacing `${BACKEND_HOST}` with its
value before nginx reads the config:

```
Container starts
    ↓
envsubst reads: /etc/nginx/templates/default.conf.template
    ${BACKEND_HOST} → replaced with "backend"
    ↓
Writes: /etc/nginx/conf.d/default.conf
    proxy_pass http://backend:80;   ← literal hostname
    ↓
nginx starts and reads the resolved config
nginx resolves "backend" → 127.0.0.11 → 172.18.0.3
```

---

### Complete Message Flow — Adding a Goal

**Step 1: User opens the browser**
```
User types: http://localhost:3000
Browser: GET http://localhost:3000/
  → Docker port mapping: host:3000 → goals-frontend-1:3000
  → nginx: path "/" → serve /usr/share/nginx/html/index.html
  → Browser receives HTML + <script> tags
```

**Step 2: Browser loads the React app**
```
Browser: GET http://localhost:3000/static/js/main.js
  → nginx: path "/static/js/..." → serve from disk
  → Browser receives JavaScript bundle
  → React app initialises in browser memory
  → React calls GET /goals to load existing goals
    → nginx: path "/goals" → proxy_pass http://backend:80/goals
    → backend queries MongoDB: db.goals.find()
    → returns JSON: {"goals": [...]}
  → React renders the goals list
```

**Step 3: User types a goal and clicks Add**
```
User action → React event handler → addGoalHandler()

Browser: POST http://localhost:3000/goals
  body: {"text": "Learn Docker multi-stage builds"}
  → nginx: path "/goals" → proxy_pass http://backend:80/goals
    → DNS: "backend" → 127.0.0.11 → 172.18.0.3
    → TCP: nginx connects to backend container port 80
    → backend receives POST /goals
    → mongoose: db.goals.insertOne({text: "..."})
    → MongoDB: writes to /data/db (named volume: goals_data)
    → returns: {"goal": {"id": "abc123", "text": "..."}}
  → nginx passes response back to browser
  → React: updates UI to show new goal
```

**Step 4: User reloads the page**
```
Browser: GET http://localhost:3000/
  → nginx serves index.html again
  → React initialises again
  → GET /goals → backend → MongoDB reads from volume
  → Goal still there — data persisted in named volume
```

**DNS resolution summary (Docker Compose):**
```
frontend → backend:80
  nginx resolves "backend"
  → /etc/resolv.conf: nameserver 127.0.0.11
  → Docker DNS returns backend container IP
  → TCP connection established

backend → mongodb:27017
  mongoose resolves "mongodb"  ← hardcoded in connection string
  → /etc/resolv.conf: nameserver 127.0.0.11
  → Docker DNS returns mongodb container IP
  → MongoDB connection established
```

---

### Why the Browser Never Talks to the Backend Directly

This is the fundamental design principle. The React app runs in the browser —
outside Docker, outside any network, on the user's machine. It cannot resolve
Docker internal hostnames like `backend` or `goals-backend-svc`.

```
Browser (user's laptop)
    ↑↓ only talks to: localhost:3000

Docker network (invisible to browser)
    frontend ←→ backend ←→ mongodb
```

By using a relative URL (`/goals` not `http://backend/goals`), the browser
sends API calls to `localhost:3000/goals` — the same address it loaded the
page from. nginx receives it and proxies it internally. The browser is
completely unaware that a separate backend service exists.

---


## Concepts

### The Core Problem in Demo 13 — Why `http://localhost` Breaks Outside Docker Compose

Before writing a single line of code, it is essential to understand **why** the
current setup is broken for any environment beyond your laptop.

**How React apps actually run**

React is not a server. When a user opens `http://localhost:3000`, the browser
downloads a JavaScript bundle and executes it entirely on the **user's machine**.
Every `fetch()` call in `App.js` is made **from the browser** — not from any
container, not from any server.

```
User's browser (laptop)
    │
    │  The React bundle runs HERE
    │  fetch('http://localhost/goals')
    │       ↑ this goes to localhost on the LAPTOP
    ▼
localhost:80 on the laptop
```

**Why it works in Demo-13 (by coincidence)**

Demo-13's `docker-compose.yaml` publishes the backend to port 80 on the host:

```yaml
backend:
  ports:
    - "80:80"    # host port 80 → container port 80
```

So `localhost:80` on the laptop **is** the backend container — Docker forwards
the connection. The hardcoded `http://localhost/goals` happens to work because
the backend is published to the exact same host and port.

**Why it breaks everywhere else**

| Environment | `http://localhost/goals` goes to | Result |
|---|---|---|
| Docker Compose (Demo-13) | backend container (port published) | ✅ Works by coincidence |
| Kubernetes | nothing on port 80 of the laptop | ❌ Connection refused |
| Cloud server | nothing (server has no browser) | ❌ Makes no sense |
| CI/CD pipeline | nothing | ❌ Test suite broken |

The app is not portable. It only works in the one environment where Docker
happens to publish port 80 to the host.

**The correct solution — relative URL + nginx proxy**

Change `App.js` to use a **relative URL** — no hostname, no port:

```javascript
fetch('/goals')   // was: fetch('http://localhost/goals')
```

The browser expands relative URLs using the **current page's hostname and port**.
If the React app loaded from `http://localhost:3000`, then `/goals` becomes
`http://localhost:3000/goals`. The browser sends the API call to the same server
that served the page.


nginx is the key — it runs **inside the container network** where it can
resolve internal hostnames (`backend`, `goals-backend-svc`). The browser
only ever talks to nginx. nginx talks to the backend on the browser's behalf.
This is the standard production pattern for any React + API application.

Demo-14 fixes this with two changes working together:

```
Before (Demo-13):
  Browser → fetch('http://localhost/goals') → hits Docker port 80 on laptop
  Works by coincidence. Breaks everywhere else.

After (Demo-14):
  Browser → fetch('/goals') → same host as the page → nginx (port 3000)
  nginx → proxy_pass → backend container (internal DNS) → MongoDB
  Works in Docker Compose, Kubernetes, and any environment.

Browser
    │  fetch('/goals')
    │  → browser expands to: http://localhost:3000/goals
    ▼
nginx in frontend container (port 3000)
    │  location /goals → proxy_pass http://backend:80
    │  nginx is a SERVER — can resolve internal DNS
    ▼
backend container (port 80)
    ▼
MongoDB
```

One change, one image — works in Docker Compose, Kubernetes, and every cloud.

---

### Multi-Stage Docker Builds

A multi-stage build uses multiple `FROM` instructions in one Dockerfile. Each
`FROM` starts a new stage. You can copy files between stages with
`COPY --from=<stage>`. Only the final stage ends up in the image.

```dockerfile
# Stage 1: builder — has Node, npm, all build tools
FROM node:18-alpine AS builder
RUN npm ci && npm run build
# Output: /app/build/ (compiled static files)

# Stage 2: runtime — has only nginx, no Node, no npm
FROM nginx:1.25-alpine
COPY --from=builder /app/build /usr/share/nginx/html
# Final image: ~25MB — no build tools, no source code
```

**Why this matters:**

| | Dev image (Demo-13) | Multi-stage image (Demo-14) |
|---|---|---|
| Contains | Node, npm, all packages, source code, nodemon | nginx + compiled static files only |
| Size | ~400MB | ~25MB |
| Attack surface | Large — Node, npm, dev tools | Minimal — nginx only |
| Suitable for | Development | Production |

### `envsubst` — Runtime Configuration in nginx

The official `nginx:alpine` Docker image includes a built-in mechanism for
runtime configuration using environment variables.

Any file you place in `/etc/nginx/templates/` with a `.template` extension is
processed at container start by `envsubst` — a tool that replaces `${VAR_NAME}`
placeholders with the values of environment variables. The result is written to
`/etc/nginx/conf.d/` and nginx reads it.

```
Container starts
    ↓
envsubst reads: /etc/nginx/templates/default.conf.template
    ${BACKEND_HOST} → replaced with value of $BACKEND_HOST env var
    ↓
Writes: /etc/nginx/conf.d/default.conf (with real hostname)
    ↓
nginx starts and reads /etc/nginx/conf.d/default.conf
```

**Example:**

Template (`/etc/nginx/templates/default.conf.template`):
```nginx
location /goals {
    proxy_pass http://${BACKEND_HOST}:80;
}
```

Container started with `-e BACKEND_HOST=backend`:
```nginx
location /goals {
    proxy_pass http://backend:80;    ← substituted
}
```

Container started with `-e BACKEND_HOST=goals-backend-svc`:
```nginx
location /goals {
    proxy_pass http://goals-backend-svc:80;    ← substituted
}
```

Same image, different environments, different backend hostnames — no rebuild.

### Environment Variable Defaults in Node.js

```javascript
const mongoHost = process.env.MONGODB_HOST || 'mongodb';
```

`||` means "use this value if the left side is undefined or empty". If
`MONGODB_HOST` is not set, `mongoHost` gets `'mongodb'` — the Docker Compose
service name. The original behaviour is fully preserved when running in Docker
Compose without setting the new env var.

This pattern makes variables **configurable but not required** — a production
best practice. New environments set the vars; existing environments work without changes.

---


### Project Setup — Copy Source from Demo-13

```bash
# Create Demo-14 directory
mkdir -p 14-goals-app-production/src
cd 14-goals-app-production

# Copy source files from Demo-13
cp -r ../13-docker-compose-goals-app/src/* ./src/
```

**Verify structure:**
```bash
tree src -L 3
```

**Expected:**
```text
src/
│
├── docker-compose.yaml
├── env/
│   └── backend.env
├── backend/
│   ├── Dockerfile
│   ├── app.js
│   ├── models/
│   └── package.json
└── frontend/
    ├── Dockerfile
    ├── package.json
    ├── public/
    └── src/
        ├── App.js
        └── components/
```

**End Project Structure**

After copying source files from Demo-13 and updates made in this demo, the project structure would look something like below. Also note , below view this does not include all the files, only highlights highlevel folder structure and changes

```
14-goals-app-production/
├── README.md                       ← this file
├── docker-compose.yaml             ← updated for production images
├── env/
|   ├── mongodb.env                 ← NEW: serves mongodb vars  
│   └── backend.env                 ← updated with new vars
└── src/
    ├── backend/
    │   ├── app.js                  ← CHANGED: configurable MongoDB connection
    │   ├── Dockerfile              ← REPLACED: production build
    │   ├── models/
    │   │   └── goal.js             ← unchanged
    │   └── package.json            ← NEW: serves for 'npm ci'
    └── frontend/
        ├── Dockerfile              ← REPLACED: multi-stage build with nginx
        ├── nginx.conf              ← NEW: serves React + proxies /goals
    │   ├── package.json            ← unchanged        
        └── src/
            ├── App.js              ← CHANGED: relative URL fetch('/goals')
            └── components/         ← unchanged
```

---

## Lab Instructions

## Step 1: Change the Frontend — Relative API URL

### What changes

`src/frontend/src/App.js` calls the backend API three times. All three currently
use `http://localhost/goals`. Change them all to `/goals` — a relative path.

**Edit `src/frontend/src/App.js` — find and replace three lines:**

**Line ~17 — fetch goals on load:**
```javascript
// Before
const response = await fetch('http://localhost/goals');

// After
const response = await fetch('/goals');
```

**Line ~42 — add a goal:**
```javascript
// Before
const response = await fetch('http://localhost/goals', {

// After
const response = await fetch('/goals', {
```

**Line ~81 — delete a goal:**
```javascript
// Before
const response = await fetch('http://localhost/goals/' + goalId, {

// After
const response = await fetch('/goals/' + goalId, {
```

**Verify — no `http://localhost` remaining:**
```bash
grep -n "fetch(" src/frontend/src/App.js
```

**Expected:**
```text
17:        const response = await fetch('/goals');
42:        const response = await fetch('/goals', {
81:        const response = await fetch('/goals/' + goalId, {
```

---

## Step 2: Create the nginx Configuration

Create `src/frontend/nginx.conf`:

```nginx
server {
    listen 3000;

    # Serve the compiled React static files
    location / {
        root   /usr/share/nginx/html;
        index  index.html;
        # Any unknown path returns index.html — required for React Router
        try_files $uri $uri/ /index.html;
    }

    # Proxy all /goals API requests to the backend
    # ${BACKEND_HOST} is replaced at container start by envsubst
    location /goals {
#        resolver        127.0.0.11 valid=10s;
#        set $backend    http://${BACKEND_HOST}:80;
#        proxy_pass      $backend;
        proxy_pass      http://${BACKEND_HOST}:80;

        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
    }
}
```

### Directive-by-directive explanation

---

**`listen 3000`**

Tells nginx which port to accept incoming connections on. We use 3000 because:
- The React app was served on port 3000 in the dev server (Demo-13)
- The docker-compose `ports: "3000:3000"` maps host port 3000 to this
- Consistency makes port-forwarding in Kubernetes predictable

Using port 80 inside the container would also work but 3000 makes it clear
this is the frontend service, not a raw web server.

---

**`location /`**

Matches all requests that do not match a more specific `location` block.
Since `location /goals` is more specific, API calls go there. Everything else
— the React HTML, JavaScript bundles, CSS, images — is handled here.

```
GET /                    → location /   (serves index.html)
GET /static/js/main.js   → location /   (serves the JS bundle)
GET /goals               → location /goals (proxied to backend)
GET /goals/abc123        → location /goals (proxied to backend)
```

**`root /usr/share/nginx/html`** — the directory where nginx looks for files
to serve. This is where `COPY --from=builder /app/build` puts the React build
output in the Dockerfile. When nginx receives `GET /static/js/main.js`, it
looks for `/usr/share/nginx/html/static/js/main.js` on disk.

**`index index.html`** — when a request is for a directory (e.g. `GET /`),
nginx serves `index.html` from that directory automatically.

**`try_files $uri $uri/ /index.html`** — this is the most important directive
for a single-page React app. It tells nginx to try three things in order:

```
1. $uri       → look for an exact file match
                 GET /logo.png → /usr/share/nginx/html/logo.png ✅ (file exists)

2. $uri/      → look for a directory with an index file
                 GET /about/ → /usr/share/nginx/html/about/index.html

3. /index.html → if neither exists, serve index.html
                 GET /dashboard → no file on disk → serve index.html
                 React Router then reads the URL and renders /dashboard ✅
```

Without `try_files`, refreshing the browser on any React route other than `/`
returns a 404 — nginx looks for a real file called `/dashboard` and finds none.
With `try_files`, nginx always falls back to `index.html` and React handles routing.

---

**`location /goals`**

Matches any request whose path starts with `/goals`. This is the API proxy block.

```
GET  /goals          → proxied to backend
POST /goals          → proxied to backend
DELETE /goals/abc123 → proxied to backend
```

The React app calls `/goals` as a relative URL — the browser expands it to
`http://localhost:3000/goals` (same host as the page). nginx intercepts it
here and forwards it to the backend service.

---
**`proxy_pass http://${BACKEND_HOST}:80`**

Forwards the incoming request to the backend. nginx acts as a transparent proxy
— the browser never communicates with the backend directly.

**Why `${BACKEND_HOST}` and not a hardcoded name like `http://backend:80`?**

`${BACKEND_HOST}` is an environment variable placeholder. The nginx Docker image
automatically runs `envsubst` on files in `/etc/nginx/templates/` at container
start, replacing `${BACKEND_HOST}` with its actual value before nginx reads the
config. By the time nginx starts, the config contains a literal hostname:
```
Container starts with: BACKEND_HOST=backend
envsubst processes:    proxy_pass http://${BACKEND_HOST}:80;
Result written to:     proxy_pass http://backend:80;
nginx reads result and starts
```

This makes the same image work in any environment by changing only the
environment variable:

| Environment | `BACKEND_HOST` value | nginx `proxy_pass` target |
|---|---|---|
| Docker Compose | `backend` | `http://backend:80` (Compose service name) |
| Kubernetes | `goals-backend-svc` | `http://goals-backend-svc:80` (K8s Service name) |

No image rebuild needed between environments.

**How nginx resolves the hostname:**

nginx resolves `backend` (or `goals-backend-svc`) using the container's
`/etc/resolv.conf` — the same DNS resolver every other process in the container
uses. In Docker Compose this is `127.0.0.11` (Docker's internal DNS). In
Kubernetes this is CoreDNS. No special configuration needed — the system
resolver handles it transparently.

nginx resolves the hostname once at startup and caches it. This is correct
behaviour for both environments:
- In Docker Compose, service IPs are stable for the container's lifetime
- In Kubernetes, `proxy_pass` targets the Service ClusterIP which never changes,
  so startup-time resolution is reliable

---

**`proxy_set_header Host $host`**

Passes the original `Host` header to the backend. Without this, the backend
receives `Host: localhost` (nginx's own hostname). With it, the backend receives
the actual hostname the client used (`Host: localhost:3000`). Some backends use
the `Host` header for routing or logging — passing it correctly is standard
reverse proxy practice.

**`proxy_set_header X-Real-IP $remote_addr`**

Passes the client's actual IP address to the backend in the `X-Real-IP` header.
Without this, the backend sees all requests coming from `127.0.0.1` (nginx's IP
from the backend's perspective). With it, the backend can log the real client IP
for access logs and security analysis.

**`proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for`**

Standard header for proxy chains. If there are multiple proxies between the
client and the backend (load balancer → nginx → backend), this header accumulates
all intermediate IPs as a comma-separated list:
```
X-Forwarded-For: <client-ip>, <proxy1-ip>, <proxy2-ip>
```
The backend can read the first IP in the list to find the original client.


---

## Step 3: Replace the Frontend Dockerfile

The current Dockerfile runs the React development server. Replace it entirely.

**Replace `src/frontend/Dockerfile`:**

```dockerfile
# ── Stage 1: build ──────────────────────────────────────────────────────────
FROM node:18-alpine AS builder
WORKDIR /app

# Install dependencies first — cached unless package.json changes
COPY package.json package-lock.json* ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build
# Output: /app/build/ — compiled HTML, JS, CSS (no Node.js needed to serve)

# ── Stage 2: serve ──────────────────────────────────────────────────────────
FROM nginx:1.25-alpine

# Remove the default nginx site configuration
RUN rm /etc/nginx/conf.d/default.conf

# Place our config as a template — envsubst processes ${BACKEND_HOST} at startup
COPY nginx.conf /etc/nginx/templates/default.conf.template

# Copy the compiled React build from Stage 1
COPY --from=builder /app/build /usr/share/nginx/html

EXPOSE 3000

# The nginx:alpine image entrypoint automatically runs envsubst on templates/
# then starts nginx. No custom CMD needed.
CMD ["nginx", "-g", "daemon off;"]
```

**Stage 1 — builder:**
- Uses `node:20-alpine` — has Node and npm for building
- `COPY package.json ... && npm ci` — installs ALL dependencies (including dev)
  needed to compile React
- `npm run build` — compiles React source into static HTML/JS/CSS in `/app/build/`
- After this stage the Node image is discarded — it never appears in the final image

**Stage 2 — runtime:**
- Uses `nginx:1.25-alpine` — ~25MB, has only nginx
- Copies our `nginx.conf` to `/etc/nginx/templates/` — the nginx image processes
  this directory automatically at startup
- Copies `/app/build` from Stage 1 — the compiled static files
- Exposes port 3000
- `nginx -g "daemon off;"` — keeps nginx in the foreground (required for Docker)

**What is NOT in the final image:**
- Node.js runtime
- npm
- React source code
- node_modules (thousands of files)
- Development dependencies

>**Why Node 18, not Node 20?** react-scripts 5.0.1 (used in this project)
was built against Node 16/18 era OpenSSL. Node 20 uses OpenSSL 3 which
breaks webpack's crypto layer with the error:
Error: error:0308010C:digital envelope routines::unsupported
Node 18 uses OpenSSL 1.1 which is fully compatible. Node 18 is only used
to compile React — the final nginx image contains no Node at all, so this
choice has zero impact on the production image.

---

## Step 4: Change the Backend — Configurable MongoDB Connection

### What changes and why

`src/backend/app.js` has this connection string:

```javascript
`mongodb://${MONGODB_USERNAME}:${MONGODB_PASSWORD}@mongodb:27017/course-goals?authSource=admin`
```

Two values are hardcoded:
- `mongodb` — the MongoDB hostname. Works in Docker Compose (service name is
  `mongodb`). Breaks in Kubernetes where the Service might have a different name.
- `course-goals` — the database name. Hardcoding it makes the image specific to
  this application. Making it configurable is the correct practice.

### Edit `src/backend/app.js`

Find the `mongoose.connect` call near the bottom of the file and replace it:

**Before:**
```javascript
mongoose.connect(
  `mongodb://${process.env.MONGODB_USERNAME}:${process.env.MONGODB_PASSWORD}@mongodb:27017/course-goals?authSource=admin`,
  {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  },
  (err) => {
    if (err) {
      console.error('FAILED TO CONNECT TO MONGODB');
      console.error(err);
    } else {
      console.log('CONNECTED TO MONGODB!! - Live reload works!');
      app.listen(80);
    }
  }
);
```

**After:**
```javascript
const mongoHost = process.env.MONGODB_HOST || 'mongodb';
const mongoDatabase = process.env.MONGODB_DATABASE || 'course-goals';

mongoose.connect(
  `mongodb://${process.env.MONGODB_USERNAME}:${process.env.MONGODB_PASSWORD}@${mongoHost}:27017/${mongoDatabase}?authSource=admin`,
  {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  },
  (err) => {
    if (err) {
      console.error('FAILED TO CONNECT TO MONGODB');
      console.error(err);
    } else {
      console.log(`CONNECTED TO MONGODB at ${mongoHost}/${mongoDatabase}`);
      app.listen(80);
    }
  }
);
```


---

## Step 5: Generate `src/backend/package-lock.json` for the backend

**Before replacing the Dockerfile, generate `package-lock.json` for the backend.**

The original Demo-13 backend used a bind mount — npm ran inside the container
at startup, so no lock file was ever committed. `npm ci` requires a lock file.
Generate it now using Docker so that npm does not need to be installed locally:
```bash
cd src/backend

docker run --rm \
  -v $(pwd):/app \
  -w /app \
  node:18-alpine \
  npm install

cd ..
```

**What each part of this command does:**
```
docker run                 Run a container
  --rm                     Remove the container automatically when it exits
                           (no cleanup needed — container is gone after npm runs)
  -v $(pwd):/app           Bind mount: map the current directory on your host
                           to /app inside the container
                           $(pwd) = the backend/ directory you cd'd into
                           /app   = where the container sees your files
  -w /app                  Set the working directory inside the container to /app
                           (equivalent to cd /app before running the command)
  node:18-alpine           The image to run — Node 18 on Alpine Linux (~50MB)
                           Used here only because it has npm — nothing is installed
                           permanently on your machine
  npm install              The command to run inside the container
                           Reads package.json, resolves dependencies, writes
                           package-lock.json — all into /app which is your
                           bind-mounted host directory
```

The result: `package-lock.json` appears in your `backend/` directory on the
host, written by npm running inside the container. Your machine never needs
Node or npm installed.

**Verify the lock file was created:**
```bash
ls src/backend/package-lock.json
```

**Expected:** File exists.

> **Why use Docker to run npm?** If npm is not installed on your machine,
> this approach runs `npm install` inside a temporary Node 18 container
> with the backend directory bind-mounted. The `package-lock.json` is
> written directly to your host directory. The container is removed after.
> If npm IS installed locally, you can run `npm install` directly instead.

---

## Step 6: Replace the Backend Dockerfile

The Demo-13 backend Dockerfile uses `nodemon` for live reload and expects a
bind-mounted source directory. Replace it with a production build.

**Replace `src/backend/Dockerfile`:**

```dockerfile
# ── Stage 1: install production dependencies ─────────────────────────────────
FROM node:18-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# ── Stage 2: production image ────────────────────────────────────────────────
FROM node:18-alpine
WORKDIR /app

# The app writes access logs here — directory must exist in the image
# (no bind mount in production to create it at runtime)
RUN mkdir -p logs

COPY --from=deps /app/node_modules ./node_modules
COPY . .

EXPOSE 80

CMD ["node", "app.js"]
```

**Key differences from the Demo-13 Dockerfile:**
- `npm ci --omit=dev` — installs only production dependencies (no nodemon, no
  dev tools). Smaller image, smaller attack surface.
- `CMD ["node", "app.js"]` — runs the app directly, not via nodemon. In
  production, process restarts are handled by Kubernetes or Docker restart
  policies — not by a file watcher.
- `RUN mkdir -p logs` — Demo-13 relied on a bind mount creating this directory.
  Without a bind mount the directory must exist in the image.
- Source code is `COPY`d into the image — no bind mount needed or expected.

---

## Step 7a: Update `env/backend.env`

Add the two new environment variables. The defaults in `app.js` already
handle the Docker Compose case, but making them explicit in the env file
is clearer and documents what the variables do.

**Update `env/backend.env`:**
```bash
MONGODB_USERNAME=rselvantech
MONGODB_PASSWORD=passWD
MONGODB_HOST=mongodb
MONGODB_DATABASE=course-goals
```

`MONGODB_HOST=mongodb` — matches the Docker Compose service name.
`MONGODB_DATABASE=course-goals` — same database name as before, now explicit.

---

## Step 7b: Add `env/mongodb.env``


Create `env/mongodb.env`:
```bash
MONGO_INITDB_ROOT_USERNAME=rselvantech
MONGO_INITDB_ROOT_PASSWORD=passWD
```

MongoDB credentials now live in an env file alongside the backend credentials they are moved here from inline `environment:`:

>Add `env/mongodb.env` to `.gitignore` alongside `env/backend.env`:


---

## Step 8: Update `docker-compose.yaml`

**Replace `docker-compose.yaml` in full:**

```yaml
name: goals

services:
  mongodb:
    image: mongo:6.0
    volumes:
      - data:/data/db
    env_file:
      - ./env/mongodb.env
    healthcheck:
      test:
        - CMD
        - mongosh
        - --eval
        - "db.adminCommand('ping')"
        - --username
        - rselvantech
        - --password
        - passWD
        - --authenticationDatabase
        - admin
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s

  backend:
    build: ./backend
    ports:
      - "80:80"
    volumes:
      - logs:/app/logs
    env_file:
      - ./env/backend.env
    depends_on:
      mongodb:
        condition: service_healthy

  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    environment:
      BACKEND_HOST: backend
    depends_on:
      - backend

volumes:
  data:
  logs:
```

**Changes from Demo-13:**

| What changed | Why |
|---|---|
| `frontend` — removed bind mount `./src/frontend/src:/app/src` | No live reload — production nginx serves compiled files |
| `frontend` — removed `stdin_open: true` and `tty: true` | Only needed by React dev server |
| `frontend` — added `environment: BACKEND_HOST: backend` | Tells nginx which hostname to proxy `/goals` to |
| `backend` — removed bind mount `./src/backend:/app` | Production image has code baked in |
| `backend` — removed anonymous volume `/app/node_modules` | Not needed without bind mount |
| `mongo:6.0` — pinned version | Reproducible builds |


**Other Changes from Demo-13: `name: goals`**

Sets a fixed project name for Docker Compose. Without this, Compose uses the
directory name as the project name — resulting in container names like
`src-backend-1`, `src-frontend-1`, `src-mongodb-1` (based on the `src/`
directory).

With `name: goals`, container names become `goals-backend-1`,
`goals-frontend-1`, `goals-mongodb-1` — immediately meaningful when you run
`docker ps` across multiple projects.

It also means the named volumes are created as `goals_data` and `goals_logs`
instead of `src_data` and `src_logs`. Consistent naming across machines and
team members regardless of what directory they cloned the repo into.

**Other Changes from Demo-13: `healthcheck` on mongodb**

```yaml
healthcheck:
  test:
    - CMD
    - mongosh
    - --eval
    - "db.adminCommand('ping')"
    - --username
    - rselvantech
    - --password
    - passWD
    - --authenticationDatabase
    - admin
  interval: 10s
  timeout: 5s
  retries: 5
  start_period: 30s
```

MongoDB takes time to initialise — especially on first run when it creates
the root user and initialises the data directory. The healthcheck runs
`mongosh --eval "db.adminCommand('ping')"` every 10 seconds. When it returns
`{ok: 1}`, MongoDB is ready to accept connections.

`start_period: 30s` — Docker does not count failed health checks during the
first 30 seconds as failures. This gives MongoDB time to initialise without
being marked unhealthy prematurely.

`interval: 10s` — check every 10 seconds after `start_period`.
`timeout: 5s` — if `mongosh` does not respond within 5 seconds, mark as failed.
`retries: 5` — after 5 consecutive failures (after `start_period`), mark as unhealthy.

---


**Other Changes from Demo-13: `depends_on` with `condition: service_healthy` on backend**

```yaml
backend:
  depends_on:
    mongodb:
      condition: service_healthy
```

This is the key change. Previously:
```yaml
depends_on:
  - mongodb    # only waits for container start, not MongoDB readiness
```

The basic `depends_on` only waits for the MongoDB container to exist — not for
MongoDB to be accepting connections. If MongoDB takes 15 seconds to initialise,
the backend starts after 1 second, tries to connect, fails, and exits.

With `condition: service_healthy`, Docker Compose waits until the MongoDB
healthcheck passes before starting the backend. The backend always connects to
a fully ready MongoDB.

```
docker compose up -d

1s  → mongodb container starts
2s  → healthcheck starts (start_period begins)
30s → start_period ends, healthchecks count
40s → mongosh ping succeeds → mongodb is service_healthy
40s → backend container starts (was waiting for service_healthy)
41s → backend connects to MongoDB successfully ✅
42s → frontend container starts
```

**Before this change:** backend exit code 0 if MongoDB wasn't ready.
**After this change:** backend always starts after MongoDB is confirmed ready.

---

## Step 9: Build and Test with Docker Compose

```bash
# Build both images from scratch — no cache from Demo-13 dev images
docker compose build --no-cache
```

**Expected — both builds complete:**
```text
[+] Building
 ✔ backend   Built
 ✔ frontend  Built
```

**Start all services — using `-v` to ensure a clean volume state:**
```bash
docker compose down -v
docker compose up -d
```

> **Why `docker compose down -v` first?** The `-v` flag removes named volumes
> (`data` and `logs`). If a `data` volume exists from a previous run — even
> from Demo-13 — MongoDB may fail to start with exit code 62 due to data
> directory ownership or version incompatibility. Starting with a clean volume
> ensures MongoDB initialises correctly with the credentials in
> `env/backend.env`.
>
> **This is safe for this demo** — MongoDB reinitialises cleanly using
> `MONGO_INITDB_ROOT_USERNAME` and `MONGO_INITDB_ROOT_PASSWORD`. Any goals
> you added in Demo-13 will be gone, which is expected — Demo-14 is a fresh
> production build.

**Verify all three containers are running:**
```bash
docker compose ps
```

**Expected — all three STATUS: Up:**
```text
NAME                IMAGE          STATUS
goals-backend-1    goals-backend    Up
goals-frontend-1   goals-frontend   Up
goals-mongodb-1    mongo:6.0        Up
```

**Verify backend connected to MongoDB with new configurable connection:**
```bash
docker compose logs backend | grep CONNECTED
```

**Expected:**
```text
backend-1  | CONNECTED TO MONGODB at mongodb/course-goals
```

**Verify nginx resolved `${BACKEND_HOST}` correctly:**
```bash
docker compose exec frontend cat /etc/nginx/conf.d/default.conf | grep -A2 "set \$backend"
```

**Expected — `backend` hostname substituted:**
```text
    proxy_pass      http://backend:80;
```

**Verify image sizes — confirm multi-stage build worked:**
```bash
docker images | grep goals
```

**Expected — frontend ~25MB, backend ~180MB (not 400MB+):**
```text
goals-frontend   latest   48.9MB
goals-backend    latest   139MB
```

### Test the Full Application

Open `http://localhost:3000` in your browser.

**Test 1 — Page loads:**
The Goals Tracker UI appears. ✅

**Test 2 — Add a goal:**
Type `"Learn multi-stage Docker builds"` → click Add Goal.
Goal appears in the list. ✅

**Test 3 — API call goes through nginx:**
```bash
docker compose logs frontend | grep goals
```

**Expected — nginx access log shows the proxied request:**
```text
frontend-1  | 172.x.x.x - "GET /goals HTTP/1.1" 200
```

**Test 4 — Data persists:**
Reload the page — goal still appears (fetched from MongoDB). ✅

**Test 5 — API directly through nginx:**
```bash
curl http://localhost:3000/goals
```

**Expected — response proxied through nginx to backend:**
```json
{"goals":[{"id":"...","text":"Learn multi-stage Docker builds"}]}
```

**Test 6 — Persistence across restart:**
```bash
docker compose down
docker compose up -d
```

Open `http://localhost:3000` — goal still appears (volume preserved). ✅

```bash
docker compose down -v
```

---

## Step 9: Build Production Images with Docker Hub Tags

Tag the images for Docker Hub:

```bash
cd src/backend
docker build -t rselvantech/goals-backend:v1.0.0 .
```

**Expected:**
```text
Successfully tagged rselvantech/goals-backend:v1.0.0
```

```bash
cd ../frontend
docker build -t rselvantech/goals-frontend:v1.0.0 .
```

**Expected:**
```text
Successfully tagged rselvantech/goals-frontend:v1.0.0
```

**Verify sizes:**
```bash
docker images rselvantech/goals-backend rselvantech/goals-frontend
```

**Expected:**
```text
REPOSITORY                    TAG      SIZE
rselvantech/goals-backend     v1.0.0   ~180MB
rselvantech/goals-frontend    v1.0.0   ~25MB
```

---

## Step 10: Push to Docker Hub

```bash
docker push rselvantech/goals-backend:v1.0.0
docker push rselvantech/goals-frontend:v1.0.0
```

**Verify both pushes succeeded:**
```bash
docker pull rselvantech/goals-backend:v1.0.0
docker pull rselvantech/goals-frontend:v1.0.0
```

**Expected:** Both pull successfully.

**Verify on Docker Hub:**
Go to `hub.docker.com/r/rselvantech/goals-backend/tags` and
`hub.docker.com/r/rselvantech/goals-frontend/tags` — both `v1.0.0` tags visible.

---

## What You Changed — Summary

| File | Action | Change |
|---|---|---|
| `src/frontend/src/App.js` | Modified | 3 lines: `http://localhost/goals` → `/goals` |
| `src/frontend/nginx.conf` | Created | Serves React, proxies `/goals` |
| `src/frontend/Dockerfile` | Replaced | Multi-stage: Node builds → nginx serves |
| `src/backend/app.js` | Modified | `MONGODB_HOST` + `MONGODB_DATABASE` env vars |
| `src/backend/Dockerfile` | Replaced | Production: `node app.js`, no nodemon |
| `src/backend/package-lock.json` | Created | created to run `npm ci` |
| `env/backend.env` | Modified | Added `MONGODB_HOST` and `MONGODB_DATABASE` |
| `env/mongodb.env` | Created | Mongodb credentials moved from inline to this file |
| `docker-compose.yaml` | Modified | `BACKEND_HOST` env, removed dev volumes |

**Images pushed:**
- `rselvantech/goals-backend:v1.0.0`
- `rselvantech/goals-frontend:v1.0.0`

---

## Key Concepts Summary

**React apps run in the browser, not on a server**
Every `fetch()` call is made from the user's laptop. Container-internal hostnames
like `backend` or `goals-backend-svc` are not resolvable by the browser. Relative
URLs (`/goals`) resolve to the same host the page was loaded from — portable
across all environments.

**Multi-stage builds separate build tools from the runtime image**
Stage 1 has everything needed to compile the app. Stage 2 has only what is needed
to run it. The final image is smaller, contains no source code, and has a minimal
attack surface.

**nginx proxies API calls from inside the container**
nginx runs on the server — it can resolve internal container and Kubernetes
hostnames. By proxying `/goals` to the backend, the frontend and backend appear
as a single service to the browser. No CORS issues, no cross-origin requests.

**`envsubst` enables runtime configuration in nginx**
The `${BACKEND_HOST}` placeholder is replaced at container start with the actual
env var value. The same image works in Docker Compose (`BACKEND_HOST=backend`)
and Kubernetes (`BACKEND_HOST=goals-backend-svc`) without rebuilding.

**Defaults preserve backward compatibility**
`process.env.MONGODB_HOST || 'mongodb'` means the variable is optional — existing
Docker Compose setups without the new env var continue to work unchanged.

---

## What's Next

These production-ready images (`rselvantech/goals-backend:v1.0.0` and
`rselvantech/goals-frontend:v1.0.0`) are used in the **ArgoCD course** — specifically
in Demo-10 (Sync Phases and Hooks), where the Goals App is deployed to Kubernetes
and sync lifecycle hooks are attached to each phase of the deployment.

The configurable environment variables (`MONGODB_HOST`, `MONGODB_DATABASE`,
`BACKEND_HOST`) become Kubernetes environment variables sourced from ConfigMaps
and Secrets — demonstrating the same portability principle at the Kubernetes level.
