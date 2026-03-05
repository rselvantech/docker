# Docker Compose Full Stack — WordPress + MySQL

## Overview

This demo builds a complete production-style multi-service application using Docker Compose. Starting from a basic two-service stack, each part adds a new concept — environment files, custom networks, health checks, and restart policies.

**Stack:**
- **WordPress** — content management system (official `wordpress` image)
- **MySQL 8.4** — database (official `mysql:8.4` image)

Both are **official Docker Hub images** — no custom code required.

**What you'll learn:**
- Multi-service Compose — `depends_on`, inter-service DNS
- Two named volumes — one for WordPress files, one for MySQL data
- Environment variables — `environment:`, `env_file:`, `.env` variable substitution
- `docker compose config` — verify resolved compose file
- Custom networks — frontend/backend network isolation
- Health checks — `healthcheck:` + `depends_on` with `condition: service_healthy`
- Restart policies — when to use each for each service type

---

## Project Structure

```
12-docker-compose-fullstack/
├── src/
│   ├── .env                 # environment variables (do NOT commit)
│   ├── .env.example         # safe to commit — template with no secrets
│   ├── .gitignore
│   └── compose.yaml
└── README.md
```

No application code — both services use official Docker Hub images directly.

---

## Part 1 — Multi-Service Stack with `depends_on`

### compose.yaml — Basic Version

**`src/compose.yaml`**

```yaml
name: wpstack

services:

  db:
    image: mysql:8.4
    container_name: wpstack-mysql
    restart: unless-stopped
    environment:
      MYSQL_ROOT_PASSWORD: dbpassword11
      MYSQL_DATABASE: wpdb               # WordPress DB — must exist before WordPress starts
      MYSQL_USER: wpuser
      MYSQL_PASSWORD: wppassword11
    ports:
      - "3306:3306"
    volumes:
      - db-data:/var/lib/mysql

  wordpress:
    image: wordpress
    container_name: wpstack-wordpress
    restart: unless-stopped
    environment:
      WORDPRESS_DB_HOST: db              # ← service name "db" — resolves via Docker DNS
      WORDPRESS_DB_USER: wpuser
      WORDPRESS_DB_PASSWORD: wppassword11
      WORDPRESS_DB_NAME: wpdb
    ports:
      - "8080:80"
    volumes:
      - wp-data:/var/www/html            # WordPress files — themes, plugins, uploads
    depends_on:
      - db                               # ← start db container before wordpress

volumes:
  db-data:
  wp-data:
```

> **Security Note:** Credentials are written directly in `compose.yaml` here for
> demo simplicity. Never do this in real projects — credentials hardcoded in compose
> files get committed to version control and exposed. In Part 2 we move them to a
> `.env` file. For production, use Docker Secrets.

### Why Two Volumes?

```
db-data   → /var/lib/mysql        MySQL data files — tables, rows, indexes
                                   If lost: all WordPress content gone ❌

wp-data   → /var/www/html         WordPress core files, themes, plugins, uploads
                                   If lost: customisations and uploads gone ❌
```

Both must persist across container restarts and replacements — both need named volumes.

### `WORDPRESS_DB_NAME` Must Already Exist

```
MySQL creates wpdb         ← via MYSQL_DATABASE=wpdb on first start ✅
WordPress connects to wpdb ← via WORDPRESS_DB_NAME=wpdb
WordPress does NOT create the database — MySQL must create it first
```

This is why `depends_on: db` matters — MySQL must start and initialize before WordPress tries to connect.

### `depends_on` Explained

```
depends_on: [db]

What it DOES:
  ✅ Ensures the db CONTAINER starts before wordpress container starts

What it DOES NOT do:
  ❌ Does NOT wait for MySQL to be ready to accept connections
  ❌ MySQL takes ~20-30 seconds to initialize — wordpress may start too early

WordPress image has a built-in retry loop for this — but Part 4 adds proper
health checks so wordpress only starts when MySQL is truly ready.
```

### Inter-Service DNS

```
Service name: db
Container name: wpstack-mysql

From the wordpress container:
  WORDPRESS_DB_HOST=db        → resolves to wpstack-mysql's IP ✅
  WORDPRESS_DB_HOST=localhost  → ❌ localhost is the wordpress container itself
```

### Step 1: Create Project Files

```bash
mkdir -p 12-docker-compose-fullstack/src
cd 12-docker-compose-fullstack/src
```

Create `compose.yaml` as shown above.

### Step 2: Start the Stack

```bash
docker compose up -d
```
```
[+] Running 4/4
 ✔ Network wpstack_default      Created
 ✔ Volume "wpstack_db-data"     Created
 ✔ Volume "wpstack_wp-data"     Created
 ✔ Container wpstack-mysql      Started
 ✔ Container wpstack-wordpress  Started
```

### Step 3: Access WordPress

Open `http://localhost:8080` — complete the WordPress installation wizard (site title, username, password, email). If the wizard loads, WordPress successfully connected to MySQL ✅

### Step 4: Verify Inter-Service DNS

```bash
# Connect to wordpress container
docker compose exec wordpress bash

# Verify db service name resolves to MySQL container IP
getent hosts db
```
```
172.18.0.2  db   ← db service name resolves to MySQL container IP ✅
```

```bash
exit
```

### Step 5: View Logs

```bash
# All services
docker compose logs

# Follow specific service
docker compose logs -f wordpress
docker compose logs -f db
```

### Step 6: Verify WordPress Tables in MySQL

```bash
docker compose exec db mysql -u wpuser -p wpdb -e "SHOW TABLES;"
```
```
+-----------------------+
| Tables_in_wpdb        |
+-----------------------+
| wp_commentmeta        |
| wp_comments           |
| wp_links              |
| wp_options            |
| wp_postmeta           |
| wp_posts              |
| wp_term_relationships |
| wp_term_taxonomy      |
| wp_termmeta           |
| wp_terms              |
| wp_usermeta           |
| wp_users              |
+-----------------------+
```

WordPress created all its tables in MySQL ✅

```bash
# Cleanup
docker compose down -v
```

---

## Part 2 — Environment Variables + `.env` File

Hardcoding credentials in `compose.yaml` is bad practice. Move them to `.env`.

### How Compose Handles Environment Variables

```
.env file               → auto-loaded by Compose for ${VAR} substitution in compose.yaml
env_file: [.env]        → injects vars directly into the container's environment
environment:            → inline vars in compose.yaml — highest precedence

Precedence (highest to lowest):
  1. environment: (inline)
  2. env_file:
  3. .env substitution
```

### Application Files

**`src/.env`**
```
# Database
MYSQL_ROOT_PASSWORD=dbpassword11
MYSQL_DATABASE=wpdb
MYSQL_USER=wpuser
MYSQL_PASSWORD=wppassword11

# WordPress DB connection
WORDPRESS_DB_HOST=db
WORDPRESS_DB_USER=wpuser
WORDPRESS_DB_PASSWORD=wppassword11
WORDPRESS_DB_NAME=wpdb

# Ports
WP_PORT=8080
```

**`src/.env.example`**
```
# Copy this file to .env and fill in values
# Never commit .env to version control

MYSQL_ROOT_PASSWORD=
MYSQL_DATABASE=
MYSQL_USER=
MYSQL_PASSWORD=

WORDPRESS_DB_HOST=db
WORDPRESS_DB_USER=
WORDPRESS_DB_PASSWORD=
WORDPRESS_DB_NAME=

WP_PORT=8080
```

**`src/.gitignore`**
```
.env
```

### Updated compose.yaml — Using `.env`

```yaml
name: wpstack

services:

  db:
    image: mysql:8.4
    container_name: wpstack-mysql
    restart: unless-stopped
    env_file:
      - .env                             # ← inject all vars from .env into container
    ports:
      - "3306:3306"
    volumes:
      - db-data:/var/lib/mysql

  wordpress:
    image: wordpress
    container_name: wpstack-wordpress
    restart: unless-stopped
    env_file:
      - .env                             # ← same .env file
    ports:
      - "${WP_PORT}:80"                  # ← ${WP_PORT} substituted from .env
    volumes:
      - wp-data:/var/www/html
    depends_on:
      - db

volumes:
  db-data:
  wp-data:
```

### Verify Resolved Compose File

```bash
docker compose config
```
```yaml
services:
  wordpress:
    ports:
      - "8080:80"       ← ${WP_PORT} resolved to 8080 ✅
```

```bash
# Start the stack
docker compose up -d

# Verify env vars injected into container
docker compose exec wordpress env | grep WORDPRESS_DB
```
```
WORDPRESS_DB_HOST=db
WORDPRESS_DB_USER=wpuser
WORDPRESS_DB_PASSWORD=wppassword11
WORDPRESS_DB_NAME=wpdb
```

```
.env          → real values, local only ❌ never commit — in .gitignore
.env.example  → empty template ✅ safe to commit
```

```bash
# Cleanup
docker compose down -v
```

---

## Part 3 — Custom Networks

By default all services share one network. In production, the DB should not be directly reachable from the host machine — only the app should expose a port.

```
Default (single network):              Custom (two networks):
──────────────────────────             ──────────────────────────────────
wordpress ──┐                          wordpress ──── frontend (host-facing)
db        ──┼── wpstack_default        wordpress ──── backend  ──── db
            │
            └── db exposed on          db has no ports: — host cannot
                host port 3306 ❌       reach MySQL directly ✅
```

### Updated compose.yaml — Custom Networks

```yaml
name: wpstack

services:

  db:
    image: mysql:8.4
    container_name: wpstack-mysql
    restart: unless-stopped
    env_file:
      - .env
    volumes:
      - db-data:/var/lib/mysql
    networks:
      - backend                          # ← db only on backend network
                                         #   no ports: — not reachable from host

  wordpress:
    image: wordpress
    container_name: wpstack-wordpress
    restart: unless-stopped
    env_file:
      - .env
    ports:
      - "${WP_PORT}:80"                  # ← only wordpress is exposed to host
    volumes:
      - wp-data:/var/www/html
    networks:
      - frontend                         # ← wordpress on both networks
      - backend                          #   reachable from host AND can reach db
    depends_on:
      - db

networks:
  frontend:
    name: wpstack-frontend
    driver: bridge
  backend:
    name: wpstack-backend
    driver: bridge

volumes:
  db-data:
  wp-data:
```

> **Why no `ports:` for db?** Removing `ports:` means MySQL is not accessible from
> the host machine at all — only `wordpress` can reach it via the `backend` network.
> This is correct production behavior — your database should never be directly
> reachable from outside Docker.

### Verify Network Setup

```bash
docker compose up -d

docker network ls | grep wpstack
```
```
wpstack-backend    bridge   local
wpstack-frontend   bridge   local
```

```bash
# db and wordpress are on backend

docker network inspect wpstack-backend --format '{{json .Containers}}' | jq
```
```
wpstack-mysql wpstack-wordpress
```

```bash
# only wordpress is on frontend

docker network inspect wpstack-frontend --format '{{json .Containers}}' | jq
```
```
wpstack-wordpress   ← db is NOT here — not host-reachable ✅
```

```bash
# Cleanup
docker compose down -v
```

---

## Part 4 — Health Checks + Smart Startup Order

`depends_on: [db]` only waits for the container to start — not for MySQL to be ready. MySQL takes 20-30 seconds to initialize fully.

```
Without health check:                With health check:
─────────────────────                ──────────────────────────────
db container starts                  db container starts
wordpress starts immediately         MySQL initializes (~25s)
wordpress tries DB connection        mysqladmin ping checks every 10s
MySQL not ready — retry loop kicks   MySQL passes health check
in — works eventually but fragile    wordpress starts cleanly ✅
```

### Updated compose.yaml — Health Checks

```yaml
name: wpstack

services:

  db:
    image: mysql:8.4
    container_name: wpstack-mysql
    restart: always
    env_file:
      - .env
    volumes:
      - db-data:/var/lib/mysql
    networks:
      - backend
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost", "-u", "root", "-pdbpassword11"]
      # Note: password matches MYSQL_ROOT_PASSWORD in .env
      # In production use Docker Secrets instead of embedding credentials here
      interval: 10s        # check every 10 seconds
      timeout: 5s          # fail if no response within 5 seconds
      retries: 5           # mark unhealthy after 5 consecutive failures
      start_period: 30s    # grace period — MySQL init failures don't count for first 30s

  wordpress:
    image: wordpress
    container_name: wpstack-wordpress
    restart: unless-stopped
    env_file:
      - .env
    ports:
      - "${WP_PORT}:80"
    volumes:
      - wp-data:/var/www/html
    networks:
      - frontend
      - backend
    depends_on:
      db:
        condition: service_healthy       # ← wait for MySQL health check to PASS
                                         #   not just for container to start

networks:
  frontend:
    name: wpstack-frontend
    driver: bridge
  backend:
    name: wpstack-backend
    driver: bridge

volumes:
  db-data:
  wp-data:
```

### Health Check Options Explained

```yaml
healthcheck:
  test: ["CMD", "mysqladmin", "ping", "-h", "localhost", "-u", "root", "-pdbpassword11"]
  #      ↑ CMD = exec directly (no shell)
  #                ↑ mysqladmin ping = MySQL's own built-in readiness check
  interval: 10s    # run check every 10s
  timeout: 5s      # fail if no response within 5s
  retries: 5       # mark unhealthy after 5 consecutive failures
  start_period: 30s # grace period — MySQL init failures don't count for first 30s
```

**`CMD` vs `CMD-SHELL`:**

| | `CMD` | `CMD-SHELL` |
|---|---|---|
| Execution | Direct exec — no shell | Runs through `/bin/sh -c` |
| Shell features | ❌ No pipes, no `&&` | ✅ Supports pipes, `&&`, redirects |
| Use when | Simple single command | Need shell features |

### `depends_on` Conditions

| Condition | Meaning | Use case |
|---|---|---|
| `service_started` | Container has started (default) | Non-critical dependencies |
| `service_healthy` | Health check has passed | ✅ Databases, APIs that need to be truly ready |
| `service_completed_successfully` | Container exited with code 0 | DB migration init containers |

### Watch Startup Sequence

```bash
docker compose up -d
```
```
[+] Running 5/0
 ✔ Network wpstack-backend      Created
 ✔ Network wpstack-frontend     Created
 ✔ Volume "wpstack_db-data"     Created
 ✔ Volume "wpstack_wp-data"     Created
 ✔ Container wpstack-mysql      Healthy   ← MySQL passed health check ✅
 ✔ Container wpstack-wordpress  Started   ← started AFTER MySQL healthy ✅
```

```bash
docker compose ps
```
```
NAME                  STATUS
wpstack-mysql         Up 2 minutes (healthy)    ← health check passing ✅
wpstack-wordpress     Up 1 minute
```

```bash
docker inspect wpstack-mysql --format '{{json .State.Health}}' | python3 -m json.tool
```
```json
{
  "Status": "healthy",
  "FailingStreak": 0,
  "Log": [
    {
      "ExitCode": 0,
      "Output": "mysqld is alive\n"
    }
  ]
}
```

---

## Part 5 — Restart Policies

Different services need different restart policies depending on their role:

```yaml
db:
  restart: always          # database must ALWAYS be available
                           # even if someone accidentally runs docker stop

wordpress:
  restart: unless-stopped  # app restarts on crash but respects manual stop
                           # good for planned maintenance
```

### Policy Comparison

```
Policy               Restart on crash?   Restart on docker stop?   Restart on daemon restart?
─────────────────────────────────────────────────────────────────────────────────────────────
no                   ❌                  ❌                         ❌
always               ✅                  ✅ (ignores manual stop)   ✅
unless-stopped       ✅                  ❌ (respects manual stop)  ✅ (if was running before stop)
on-failure           ✅ (non-zero exit)  ❌                         ✅ (if was running)
```

### When to Use Each

| Policy | Best for |
|---|---|
| `no` | Development, one-off tasks, migration containers |
| `always` | Databases — must always be available, even after accidental stop |
| `unless-stopped` | ✅ Web apps, APIs — best general-purpose production policy |
| `on-failure` | Workers, queue consumers — retry on crash but stop cleanly when done |

### Verify Restart Policy

```bash
docker inspect wpstack-mysql --format '{{.HostConfig.RestartPolicy.Name}}'
```
```
always
```

```bash
docker inspect wpstack-wordpress --format '{{.HostConfig.RestartPolicy.Name}}'
```
```
unless-stopped
```

```bash
# Cleanup
docker compose down -v
```

---

## Final `compose.yaml` — All Parts Combined

**`src/compose.yaml`**

```yaml
name: wpstack

services:

  db:
    image: mysql:8.4
    container_name: wpstack-mysql
    restart: always
    env_file:
      - .env
    volumes:
      - db-data:/var/lib/mysql
    networks:
      - backend
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost", "-u", "root", "-pdbpassword11"]
      # Note: password matches MYSQL_ROOT_PASSWORD in .env
      # In production use Docker Secrets instead of embedding credentials here
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s

  wordpress:
    image: wordpress
    container_name: wpstack-wordpress
    restart: unless-stopped
    env_file:
      - .env
    ports:
      - "${WP_PORT}:80"
    volumes:
      - wp-data:/var/www/html
    networks:
      - frontend
      - backend
    depends_on:
      db:
        condition: service_healthy

networks:
  frontend:
    name: wpstack-frontend
    driver: bridge
  backend:
    name: wpstack-backend
    driver: bridge

volumes:
  db-data:
    name: wpstack-db-data
    driver: local
    labels:
      project: wpstack
      component: database
  wp-data:
    name: wpstack-wp-data
    driver: local
    labels:
      project: wpstack
      component: wordpress
```

---

## Lab — Full Run

```bash

# Start full stack
docker compose up -d

# Watch MySQL become healthy
docker compose ps

# Access WordPress
# http://localhost:8080 ← complete the setup wizard

# Verify env vars loaded correctly
docker compose exec wordpress env | grep WORDPRESS_DB

# Verify resolved compose file
docker compose config

# Check WordPress tables created in MySQL after setup wizard
docker compose exec db mysql -u wpuser -p wpdb -e "SHOW TABLES;"

# Cleanup — preserve data
docker compose down

# Cleanup — remove everything including volumes
docker compose down -v
```

---

## Key Takeaways

| Concept | Key Point |
|---|---|
| `depends_on` | Only ensures container started — not that service is ready |
| `condition: service_healthy` | Waits for health check to pass — use for databases |
| `healthcheck: start_period` | Grace period for initialization — set 30s+ for MySQL |
| `mysqladmin ping` | MySQL's own readiness tool — lightweight, no SQL query needed |
| Two volumes | `db-data` for MySQL files, `wp-data` for WordPress files — both must persist |
| `WORDPRESS_DB_NAME` | WordPress does NOT create the DB — MySQL must create it via `MYSQL_DATABASE` |
| `env_file:` | Injects vars into container — separates config from compose file |
| `.env` | Auto-loaded for `${VAR}` substitution in compose.yaml |
| `docker compose config` | Verify all variables are resolved correctly before deploying |
| Custom networks | Removes DB host exposure — only WordPress exposes a port, DB is internal only |
| `WORDPRESS_DB_HOST=db` | Always use service name — never `localhost` for inter-service communication |
| `restart: always` | Use for databases — must survive accidental stops |
| `restart: unless-stopped` | Best general-purpose policy for apps — respects manual maintenance stops |
| `.env` in `.gitignore` | Never commit real credentials — always provide `.env.example` |
