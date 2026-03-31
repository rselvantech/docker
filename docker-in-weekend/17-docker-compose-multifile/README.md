# Docker Compose Multiple Files — Base + Override Pattern

## Overview

A single `compose.yaml` rarely fits all environments. Development needs volume mounts and debug ports. Production needs tighter restart policies and no exposed DB ports. Instead of maintaining separate duplicate files, Compose merges multiple files in order — later files override earlier ones.

**What you'll learn:**
- `compose.override.yaml` — auto-loaded merge file for development
- `-f` flag — explicitly specify which files to merge
- Merge rules — scalars override, lists append, maps merge
- `docker compose config` — inspect the final merged result
- `include:` top-level key — modularise large stacks (theory)
- `extends:` — inherit from another service (theory)
- YAML anchors (`x-` extension fields) — DRY config (theory)

---

## Project Structure

```
17-docker-compose-multifile/
├── src/
│   ├── compose.yaml             # base — shared config for all environments
│   ├── compose.override.yaml    # dev overrides — auto-loaded
│   ├── compose.prod.yaml        # prod overrides — explicit with -f
│   └── .gitignore
└── README.md
```

---

## How Multi-File Compose Works

```
Auto-loaded:
  docker compose up -d
  → reads compose.yaml
  → reads compose.override.yaml (if present, auto-merged)

Explicit with -f:
  docker compose -f compose.yaml -f compose.prod.yaml up -d
  → reads compose.yaml
  → merges compose.prod.yaml on top
  → compose.override.yaml is NOT loaded when -f is used

Order matters — later files win on conflicts.
```

---

## Application Files

### `src/compose.yaml` — Base (Shared Config)

```yaml
name: multifile

services:

  db:
    image: mysql:8.4
    container_name: multifile-db
    environment:
      MYSQL_ROOT_PASSWORD: dbpassword11
      MYSQL_DATABASE: wpdb
      MYSQL_USER: wpuser
      MYSQL_PASSWORD: wppassword11
    volumes:
      - db-data:/var/lib/mysql
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost", "-u", "root", "-pdbpassword11"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s

  wordpress:
    image: wordpress
    container_name: multifile-wordpress
    environment:
      WORDPRESS_DB_HOST: db
      WORDPRESS_DB_USER: wpuser
      WORDPRESS_DB_PASSWORD: wppassword11
      WORDPRESS_DB_NAME: wpdb
    volumes:
      - wp-data:/var/www/html
    depends_on:
      db:
        condition: service_healthy

volumes:
  db-data:
  wp-data:
```

The base file contains **only shared config** — no ports, no restart policies, no environment-specific settings. It is not intended to be run alone.

---

### `src/compose.override.yaml` — Development Overrides (Auto-Loaded)

```yaml
# Development overrides — auto-loaded when running docker compose up
# Adds: ports, debug env vars, less strict restart policy

services:

  db:
    ports:
      - "3306:3306"             # expose DB port to host for local DB clients
    restart: unless-stopped

  wordpress:
    ports:
      - "8080:80"               # expose WordPress on port 8080
    restart: unless-stopped
    environment:
      WORDPRESS_DEBUG: "1"      # enable WordPress debug mode in dev
```

`compose.override.yaml` is **automatically merged** with `compose.yaml` whenever you run `docker compose` commands — no flags needed.

---

### `src/compose.prod.yaml` — Production Overrides (Explicit)

```yaml
# Production overrides — used with: docker compose -f compose.yaml -f compose.prod.yaml
# Adds: strict restart, no DB port exposed, no debug mode

services:

  db:
    restart: always             # DB must always be available in prod
    # no ports: — DB not exposed to host in production

  wordpress:
    ports:
      - "80:80"                 # expose on standard port 80 in prod
    restart: unless-stopped
    # no WORDPRESS_DEBUG — debug disabled in prod
```

### `src/.gitignore`

```
.env
```

---

## Lab Instructions

### Step 1: Create Project Files

```bash
mkdir -p 17-docker-compose-multifile/src
cd 17-docker-compose-multifile/src
```

Create all three compose files as shown above.

---

### Step 2: Development — Auto-Loaded Override

```bash
docker compose up -d
```

Compose automatically merged `compose.yaml` + `compose.override.yaml`.

```bash
# Verify WordPress and DB ports are exposed (from override)
docker compose ps
```
```
NAME                    STATUS    PORTS
multifile-db            Up        0.0.0.0:3306->3306/tcp     ← from override ✅
multifile-wordpress     Up        0.0.0.0:8080->80/tcp       ← from override ✅
```

```bash
# Access WordPress
open http://localhost:8080
```

### Step 3: Inspect the Merged Config

`docker compose config` shows the fully merged result — exactly what Compose is working with:

```bash
docker compose config
```
```yaml
services:
  db:
    image: mysql:8.4
    ports:
      - "3306:3306"             ← merged from override ✅
    restart: unless-stopped     ← merged from override ✅
    environment:
      MYSQL_ROOT_PASSWORD: dbpassword11
      ...
  wordpress:
    image: wordpress
    ports:
      - "8080:80"               ← merged from override ✅
    environment:
      WORDPRESS_DEBUG: "1"      ← merged from override ✅
      ...
```

Always run `docker compose config` before deploying to verify your merged result is what you expect.

```bash
docker compose down -v
```

---

### Step 4: Production — Explicit `-f` Flag

```bash
docker compose -f compose.yaml -f compose.prod.yaml up -d
```

`-f` is provided explicitly so `compose.override.yaml` is **not** auto-loaded. Only `compose.yaml` + `compose.prod.yaml` are merged.

```bash
docker compose -f compose.yaml -f compose.prod.yaml ps
```
```
NAME                    STATUS    PORTS
multifile-db            Up        (no ports)              ← not exposed in prod ✅
multifile-wordpress     Up        0.0.0.0:80->80/tcp      ← port 80 in prod ✅
```

### Step 5: Verify Production Merged Config

```bash
docker compose -f compose.yaml -f compose.prod.yaml config
```
```yaml
services:
  db:
    restart: always             ← from prod override ✅
    # no ports exposed          ← not added in prod ✅
  wordpress:
    ports:
      - "80:80"                 ← from prod override ✅
    environment:
      WORDPRESS_DB_HOST: db
      # no WORDPRESS_DEBUG      ← not added in prod ✅
```

```bash
docker compose -f compose.yaml -f compose.prod.yaml down -v
```

---

## Merge Rules

Understanding how values merge prevents surprises:

```
Scalar values (string, number, boolean) — last file wins:
  base:     restart: "no"
  override: restart: unless-stopped
  result:   restart: unless-stopped     ← override wins ✅

Maps (environment:, labels:) — merged by key, later wins on conflict:
  base:     environment: { A: base, B: base }
  override: environment: { B: override, C: new }
  result:   environment: { A: base, B: override, C: new }  ← merged ✅

Lists (ports:, volumes:) — appended (combined):
  base:     ports: ["80:80"]
  override: ports: ["443:443"]
  result:   ports: ["80:80", "443:443"]  ← both kept ✅
```

> **List append gotcha:** If both files define the same port mapping, it appears twice and causes a conflict. Design files so port mappings are only in override files, not in both base and override.

---

## `compose.override.yaml` — Auto-Load Behavior

```
Files present                          What Compose reads
──────────────────────────────────────────────────────────────────────
compose.yaml only                    → compose.yaml
compose.yaml + compose.override.yaml → compose.yaml + compose.override.yaml (auto-merged)
-f compose.yaml -f compose.prod.yaml → only these two files (override NOT loaded)
```

> **Important:** When you use `-f` explicitly, the auto-load of `compose.override.yaml` is disabled. This is why prod deployments should always use explicit `-f` flags.

---

## Theory — `include:` (Modular Stacks)

For large projects with many services, `include:` lets you split services across multiple files and reference them from a main `compose.yaml`:

```yaml
# compose.yaml
include:
  - path: ./infra/database.yaml     # DB services in their own file
  - path: ./infra/cache.yaml        # Redis/cache in its own file

services:
  web:
    build: .
    depends_on:
      - db                          # db defined in database.yaml
```

Each included file loads as an independent Compose project with its own path resolution. Unlike merge (which combines into one model), `include` keeps each file isolated until they're composed together. Available in Compose v2.20+.

---

## Theory — `extends:` (Service Inheritance)

`extends:` lets a service inherit config from another service or file — useful for DRY patterns across similar services:

```yaml
# base.yaml
services:
  base-app:
    image: myapp
    restart: unless-stopped
    logging:
      driver: json-file

# compose.yaml
services:
  web:
    extends:
      file: base.yaml
      service: base-app
    ports:
      - "8080:80"   # add web-specific config on top of base

  worker:
    extends:
      file: base.yaml
      service: base-app
    command: python worker.py   # same base, different command
```

Not commonly needed for simple stacks — use when managing many similar services.

---

## Theory — YAML Anchors + `x-` Extension Fields

YAML anchors let you define a block once and reuse it, avoiding repetition. The `x-` prefix marks custom extension fields that Compose ignores but YAML processes:

```yaml
# Define reusable blocks with x- prefix (Compose ignores x- keys)
x-common-env: &common-env
  TZ: UTC
  LOG_LEVEL: info

x-healthcheck: &default-healthcheck
  interval: 30s
  timeout: 10s
  retries: 3

services:
  web:
    environment:
      <<: *common-env       # merge anchor — injects TZ and LOG_LEVEL
      APP_PORT: "8080"
    healthcheck:
      <<: *default-healthcheck  # merge anchor
      test: ["CMD", "curl", "-f", "http://localhost:8080/health"]

  api:
    environment:
      <<: *common-env       # same env vars reused ✅
      APP_PORT: "9090"
    healthcheck:
      <<: *default-healthcheck  # same healthcheck defaults reused ✅
      test: ["CMD", "curl", "-f", "http://localhost:9090/health"]
```

Useful for large stacks with many similar services. For simple stacks, prefer multiple files over YAML anchors — more readable.

---

## Key Takeaways

| Concept | Key Point |
|---|---|
| `compose.override.yaml` | Auto-loaded and merged with `compose.yaml` — no flags needed |
| `-f` flag | Explicit file list — disables auto-load of override file |
| File order matters | Later `-f` files win on scalar conflicts |
| `docker compose config` | Always inspect merged result before deploying |
| Scalar merge | Last file wins — `restart: always` overrides `restart: no` |
| Map merge | Keys combined — later file wins on duplicate keys |
| List merge | Lists appended — avoid duplicate port mappings across files |
| Base file | Contains only shared config — not standalone runnable |
| Dev override | Adds ports, debug vars, relaxed restart — in `compose.override.yaml` |
| Prod override | Adds strict restart, no debug, prod ports — use with `-f` |
| `include:` | Modular sub-files — each loads independently, v2.20+ |
| `extends:` | Service inheritance — DRY for similar services |
| YAML anchors | `x-` prefix + `&anchor` / `*anchor` — reuse blocks within a file |