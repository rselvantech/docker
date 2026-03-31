# Docker Compose Scale — `--scale` Flag + `deploy: replicas:`

## Overview

Scaling means running multiple identical containers for the same service to handle more traffic or provide redundancy. Compose supports two approaches: `--scale` flag at runtime (temporary, no file change needed) and `deploy: replicas:` in `compose.yaml` (permanent, declared in code).

**What you'll learn:**
- `docker compose up --scale <service>=<n>` — scale at runtime
- `deploy: replicas:` — declare replica count in compose.yaml
- Why `container_name:` must be removed when scaling
- Port range mapping for scaled services
- `docker compose ps` — verify running replicas
- `docker compose up --scale` to scale down
- `docker compose scale` — deprecated, theory only

---

## Project Structure

```
18-docker-compose-scale/
├── src/
│   └── compose.yaml
└── README.md
```

**Stack:** Nginx as a simple stateless web service — ideal for scaling. MySQL is intentionally not scaled (single-instance DB is the common pattern).

---

## Why Scaling Needs Special Compose Config

Two things break when you scale a service naively:

**Problem 1 — `container_name:` must be removed**

```yaml
# ❌ This fails when scaled — two containers cannot share one name
web:
  container_name: my-web    ← only one container can have this name
```

When Compose tries to create a second `web` container, it fails because `my-web` already exists. Remove `container_name:` and let Compose auto-generate names: `<project>-<service>-1`, `<project>-<service>-2`, etc.

**Problem 2 — Fixed port mapping causes conflicts**

```yaml
# ❌ This fails when scaled — two containers cannot bind to the same host port
web:
  ports:
    - "8080:80"    ← host port 8080 can only be used by one container
```

Use a **port range** instead — Compose assigns a unique host port from the range to each container:

```yaml
# ✅ Port range — each replica gets a different host port
web:
  ports:
    - "8080-8082:80"    ← container 1=8080, container 2=8081, container 3=8082
```

---

## `compose.yaml`

**`src/compose.yaml`**

```yaml
name: scaledemo

services:

  web:
    image: nginx:alpine
    # container_name is intentionally omitted — required for scaling
    # Compose auto-names: scaledemo-web-1, scaledemo-web-2, etc.
    ports:
      - "8080-8085:80"   # port range — each replica gets a unique host port
    restart: unless-stopped
```

---

## Lab Instructions

### Step 1: Create Project Files

```bash
mkdir -p 18-docker-compose-scale/src
cd 18-docker-compose-scale/src
```

Create `compose.yaml` as shown above.

---

### Step 2: Start with One Replica (Default)

```bash
docker compose up -d
```
```
[+] Running 2/2
 ✔ Network scaledemo_default   Created
 ✔ Container scaledemo-web-1   Started    ← auto-named, single replica
```

```bash
docker compose ps
```
```
NAME              IMAGE          STATUS    PORTS
scaledemo-web-1   nginx:alpine   Up        0.0.0.0:8080->80/tcp
```

One container, port 8080 assigned ✅

---

### Step 3: Scale Up to 3 Replicas

```bash
docker compose up -d --scale web=3
```
```
[+] Running 3/3
 ✔ Container scaledemo-web-1   Running    ← already running, untouched
 ✔ Container scaledemo-web-2   Started    ← new replica
 ✔ Container scaledemo-web-3   Started    ← new replica
```

Compose started 2 additional containers. The existing `scaledemo-web-1` was left running.

```bash
docker compose ps
```
```
NAME              IMAGE          STATUS    PORTS
scaledemo-web-1   nginx:alpine   Up        0.0.0.0:8080->80/tcp
scaledemo-web-2   nginx:alpine   Up        0.0.0.0:8081->80/tcp
scaledemo-web-3   nginx:alpine   Up        0.0.0.0:8082->80/tcp
```

Three replicas, each on a different host port ✅

```bash
# Verify all three serve content
curl http://localhost:8080
curl http://localhost:8081
curl http://localhost:8082
```

All return Nginx default page ✅

---

### Step 4: Scale Up Further

```bash
docker compose up -d --scale web=5
```
```
[+] Running 5/5
 ✔ Container scaledemo-web-1   Running
 ✔ Container scaledemo-web-2   Running
 ✔ Container scaledemo-web-3   Running
 ✔ Container scaledemo-web-4   Started    ← added
 ✔ Container scaledemo-web-5   Started    ← added
```

```bash
docker compose ps
```
```
NAME              PORTS
scaledemo-web-1   0.0.0.0:8080->80/tcp
scaledemo-web-2   0.0.0.0:8081->80/tcp
scaledemo-web-3   0.0.0.0:8082->80/tcp
scaledemo-web-4   0.0.0.0:8083->80/tcp
scaledemo-web-5   0.0.0.0:8084->80/tcp
```

---

### Step 5: Scale Down

```bash
docker compose up -d --scale web=2
```
```
[+] Running 2/5
 ✔ Container scaledemo-web-1   Running
 ✔ Container scaledemo-web-2   Running
 ✔ Container scaledemo-web-3   Removed    ← removed
 ✔ Container scaledemo-web-4   Removed    ← removed
 ✔ Container scaledemo-web-5   Removed    ← removed
```

Compose removed the excess containers from the highest number down.

```bash
docker compose ps
```
```
NAME              PORTS
scaledemo-web-1   0.0.0.0:8080->80/tcp
scaledemo-web-2   0.0.0.0:8081->80/tcp
```

---

## `deploy: replicas:` — Declare in `compose.yaml`

Instead of specifying scale at runtime, declare it in the compose file:

```yaml
services:
  web:
    image: nginx:alpine
    ports:
      - "8080-8085:80"
    deploy:
      replicas: 3             # always start 3 replicas
```

```bash
docker compose up -d
```
```
 ✔ Container scaledemo-web-1   Started
 ✔ Container scaledemo-web-2   Started
 ✔ Container scaledemo-web-3   Started    ← 3 replicas from deploy.replicas ✅
```

**`--scale` vs `deploy: replicas:`:**

```
--scale at runtime:        Temporary — not saved in file. Useful for quick testing.
deploy: replicas: in file: Permanent — declarative, version-controlled, reproducible.
```

If both are set, `--scale` overrides `deploy: replicas:` at runtime.

---

## Services You Should NOT Scale

Not every service benefits from scaling. Some require special handling:

```
Service          Scale?   Why
───────────────────────────────────────────────────────────────────────
Nginx (stateless)  ✅     Each request is independent — safe to scale
MySQL / Postgres   ❌     Single writer model — scaling needs clustering (not covered here)
Redis (standalone) ❌     Single instance — clustering requires Redis Sentinel/Cluster setup
WordPress          ⚠️     Stateless request handling is fine, but shared filesystem needed
                          (both containers need access to same uploads — use shared volume)
```

---

## `docker compose scale` — Deprecated

The standalone `docker compose scale` command was the old way to scale:

```bash
# ❌ Deprecated — do not use
docker compose scale web=3
```

It was deprecated in favour of `docker compose up --scale`. Modern Compose V2 produces a warning if you try to use it. Always use:

```bash
# ✅ Current — use this
docker compose up -d --scale web=3
```

---

## Scaling Multiple Services at Once

```bash
# Scale two services simultaneously
docker compose up -d --scale web=3 --scale api=2
```

Each service scales independently.

---

## Key Takeaways

| Concept | Key Point |
|---|---|
| `container_name:` | Must be removed — cannot have duplicate names across replicas |
| Port range `8080-8085:80` | Assigns unique host port per replica — required for scaled services |
| `docker compose up --scale web=3` | Scales service to 3 replicas at runtime |
| `deploy: replicas: 3` | Declares replica count in compose.yaml — permanent and version-controlled |
| `--scale` overrides `replicas:` | Runtime flag takes precedence over file declaration |
| Scale up | `--scale web=5` — Compose adds missing containers |
| Scale down | `--scale web=2` — Compose removes excess containers from highest number |
| Stateless services | Safe to scale — Nginx, APIs with no local state |
| Stateful services | Not safe to scale without special setup — databases, message queues |
| `docker compose scale` | Deprecated — use `docker compose up --scale` instead |
