# Docker Compose Basics — MySQL + Named Volumes

## Overview

This demo introduces Docker Compose — the tool that replaces long `docker run` commands with a single declarative YAML file. You will deploy a MySQL database using Compose and learn how to manage named volumes with metadata.

**What you'll learn:**
- What Docker Compose is and why it exists
- `compose.yaml` structure — `name`, `services`, `volumes` top-level keys
- Why the `version:` field is obsolete and removed
- `docker compose` (V2) vs `docker-compose` (V1 legacy)
- Deploy and manage a MySQL service with Compose
- Named volume with metadata — `name`, `driver`, `labels`
- Auto-created default network
- Core Compose commands — `up`, `down`, `ps`, `logs`

---

## Why Docker Compose

Without Compose, deploying a multi-container application requires running multiple commands manually:

```bash
# Without Compose — manual, error-prone, not repeatable
docker network create taskapp-network
docker volume create taskapp-db-data

docker run -d \
  --name taskapp-mysql \
  --network taskapp-network \
  -e MYSQL_ROOT_PASSWORD=dbpassword11 \
  -e MYSQL_DATABASE=taskappdb \
  -p 3306:3306 \
  -v taskapp-db-data:/var/lib/mysql \
  --restart unless-stopped \
  mysql:8.4
```

With Compose — **one file, one command**:

```bash
docker compose up -d
```

```
Same result:
✅ Network created automatically
✅ Volume created automatically
✅ Container started with all config from compose.yaml
✅ Repeatable — same result every time, on every machine
```

---

## `docker compose` vs `docker-compose` — Know the Difference

```
docker-compose (V1)              docker compose (V2)
────────────────────             ──────────────────
Standalone Python binary         Go plugin, part of Docker CLI
Installed separately             Ships with Docker Desktop / Engine
Invoked as: docker-compose       Invoked as: docker compose (space)
Legacy — officially deprecated   ✅ Current standard — use this
Slower                           Faster
```

> **Always use `docker compose` (with a space) — not `docker-compose` (with a hyphen).**
> The hyphen version is deprecated and will eventually be removed.

---

## `version:` Field — Why It Is Removed

Older Compose files started with `version: '3.8'` or `version: '2.1'`. This is now **obsolete**:

```yaml
# ❌ Old — version field is obsolete, produces a warning in Compose V2
version: '3.8'
services:
  ...

# ✅ Modern — no version field, uses Compose Specification
services:
  ...
```

The Compose Specification merged all legacy versions (2.x and 3.x) into a single spec implemented in Compose V2 (v1.27.0+). The `version` field is ignored and produces a deprecation warning. **Never include it in new files.**

---

## Compose File Name

```
compose.yaml          ← ✅ Official recommended name
compose.yml           ← ✅ Also accepted
docker-compose.yaml   ← ⚠️ Accepted for backwards compatibility
docker-compose.yml    ← ⚠️ Accepted for backwards compatibility
```

> When multiple files exist, `compose.yaml` takes priority.

---

## Project Structure

```
11-docker-compose-basics/
├── src/
│   └── compose.yaml
└── README.md
```

---

## `compose.yaml` Structure

```yaml
name: taskapp                     # ← top-level: project/stack name

services:                         # ← top-level: define containers
  db:                             #   service name (used for DNS)
    image: mysql:8.4
    container_name: taskapp-mysql
    ...

volumes:                          # ← top-level: declare named volumes
  db-data:
    ...
```

**Three top-level keys:**

| Key | Purpose |
|---|---|
| `name` | Sets the project/stack name — used to prefix all resources |
| `services` | Defines each container — image, ports, env vars, volumes, etc. |
| `volumes` | Declares named volumes that services can mount |
| `networks` | (optional) Declares custom networks — covered in Demo 12 |

---

## Application File

**`src/compose.yaml`** — Version 1: Minimal (used in this demo)

```yaml
name: taskapp

services:
  db:
    image: mysql:8.4
    container_name: taskapp-mysql
    restart: unless-stopped
    environment:
      MYSQL_ROOT_PASSWORD: dbpassword11
      MYSQL_DATABASE: taskappdb
    ports:
      - "3306:3306"
    volumes:
      - db-data:/var/lib/mysql

volumes:
  db-data:              # minimal — just the reference name, nothing else required
```
> **Security Note:** The `MYSQL_ROOT_PASSWORD`  value is written
> directly in `compose.yaml` here for demo simplicity. Never do this in real projects —
> credentials hardcoded in compose files get committed to version control and exposed.
> In Demo 12 we move credentials to a `.env` file. For production, use Docker Secrets.
---

## Compose File Explained

### Service Definition

```yaml
services:
  db:                             # service name — used for DNS between containers
    image: mysql:8.4              # official MySQL 8.4 LTS image
    container_name: taskapp-mysql # explicit container name (optional — auto-generated if omitted)
    restart: unless-stopped       # restart policy — see section below
    environment:                  # environment variables passed to container
      MYSQL_ROOT_PASSWORD: dbpassword11
      MYSQL_DATABASE: taskappdb   # MySQL creates this database on first start
    ports:
      - "3306:3306"               # host:container — expose to local machine
    volumes:
      - db-data:/var/lib/mysql    # mount named volume at MySQL data directory
```
---

### Named Volume Definition

**Version 1 — Minimal (used in this demo):**

```yaml
volumes:
  db-data:              # just the reference name — everything else is optional
```

This is all that is required. Compose does the rest automatically:
- Auto-names the volume as `taskapp_db-data` (project name + reference name)
- Uses `local` driver by default
- No labels added

**Version 2 — With metadata (optional, for production/reference):**

```yaml
volumes:
  db-data:                        # volume reference name used in services
    name: taskapp-db-data         # OPTIONAL — overrides auto-naming (taskapp_db-data → taskapp-db-data)
    driver: local                 # OPTIONAL — local is already the default
    labels:                       # OPTIONAL — metadata for management and filtering
      project: taskapp
      component: database
      managed-by: docker-compose
```

| Field | Required | Default if omitted | When to add |
|---|---|---|---|
| `name` | ❌ Optional | `<project>_<ref-name>` e.g. `taskapp_db-data` | When you need a predictable, portable volume name |
| `driver` | ❌ Optional | `local` | When using a non-local driver (cloud storage, NFS) |
| `labels` | ❌ Optional | none | When managing many volumes and need filtering/audit |

**Why set an explicit `name`?**

Without `name`, Compose auto-generates: `taskapp_db-data` (project name prefix + `_` + reference name).
With `name: taskapp-db-data`, you control the exact name — useful for scripting, external tooling, and cross-project volume sharing.

### `restart` Policy

| Value | Behavior |
|---|---|
| `no` | Never restart — default |
| `always` | Always restart — even after `docker stop` or Docker daemon restart |
| `on-failure` | Restart only on non-zero exit code — stops if it exits cleanly |
| `unless-stopped` | ✅ Restart always **except** when explicitly stopped with `docker stop` |

```
**unless-stopped** — production recommendation:
  Container crashes              → restarts automatically ✅
  Docker daemon restarts         → restarts automatically ✅ (if container was running)
  docker stop <n>                → stays stopped ✅ (respects manual stop)
  docker compose down            → stays stopped ✅ (respects compose down)
  Daemon restarts after stop     → stays stopped ✅ (remembers it was manually stopped)

**always** — difference from unless-stopped:
  docker stop <n>                → still restarts on Docker daemon restart ❌
  Daemon restarts after stop     → restarts anyway ❌ (ignores manual stop)
```

---

### Auto-Created Default Network

Compose automatically creates a default bridge network for the project:

```
Network name: taskapp_default   ← project name + "_default"

All services in compose.yaml join this network automatically.
Services can reach each other using the SERVICE NAME as hostname.
Example: another service can connect to MySQL at hostname "db" port 3306.
```

---

## Lab Instructions

### Step 1: Create Project Files

```bash
cd 11-docker-compose-basics/src
```

Create `compose.yaml` as shown in **Application File** above.

---

### Step 2: Start the Stack

```bash
# -d = detached mode — frees terminal, runs in background
docker compose up -d
```

```
[+] Running 3/3
 ✔ Network taskapp_default     Created   ← auto-created network
 ✔ Volume "taskapp_db-data"    Created   ← volume auto-named: <project>_<ref-name>
 ✔ Container taskapp-mysql     Started   ← MySQL container started
```

> **`docker compose up` vs `docker compose up -d`:**
> Without `-d`, terminal is blocked and attached to container logs — `Ctrl+C` stops everything.
> With `-d`, terminal is freed — always use `-d` in practice.

---

### Step 3: Verify Running Services

```bash
docker compose ps
```
```
NAME            IMAGE       COMMAND                  SERVICE   STATUS          PORTS
taskapp-mysql   mysql:8.4   "docker-entrypoint.s…"   db        Up 30 seconds   0.0.0.0:3306->3306/tcp
```

```bash
# Also works — standard docker ps
docker ps
```

---

### Step 4: View Logs

```bash
# View logs for all services
docker compose logs

# View logs for a specific service — use SERVICE NAME not container name
docker compose logs db

# Follow logs in real time
docker compose logs -f db
```

```
taskapp-mysql  | 2025-01-01 00:00:01+00:00 [Note] [Entrypoint]: Entrypoint script for MySQL Server started.
taskapp-mysql  | 2025-01-01 00:00:05+00:00 [Note] [Entrypoint]: MySQL Database created successfully.
taskapp-mysql  | 2025-01-01 00:00:08+00:00 [System] [MY-010931] [Server] /usr/sbin/mysqld: ready for connections.
```

> **Always use the service name with `docker compose logs`** — `db` not `taskapp-mysql`.
> The service name is what Compose knows about. Container name is Docker-level.

---

### Step 5: Verify Network Created

```bash
docker network ls | grep taskapp
```
```
abc123   taskapp_default   bridge   local
```

```bash
docker network inspect taskapp_default
```
```json
{
  "Name": "taskapp_default",
  "Driver": "bridge",
  "Containers": {
    "...": {
      "Name": "taskapp-mysql",
      "IPv4Address": "172.18.0.2/16"
    }
  }
}
```

---

### Step 6: Verify Volume Created

```bash
docker volume ls | grep taskapp
```
```
local   taskapp_db-data   ← auto-named: project name (taskapp) + _ + reference name (db-data)
```

```bash
docker volume inspect taskapp_db-data
```
```json
[
  {
    "Name": "taskapp_db-data",
    "Driver": "local",
    "Mountpoint": "/var/lib/docker/volumes/taskapp_db-data/_data",
    "Labels": null,
    "Scope": "local"
  }
]
```

No `Labels` — because we used the minimal volume declaration with no metadata.

---

### Step 6b: Optional — Verify Volume with Metadata (Version 2)

To see what the metadata version produces, update `compose.yaml` volumes section:

```yaml
volumes:
  db-data:
    name: taskapp-db-data         # explicit name — replaces auto-generated taskapp_db-data
    driver: local
    labels:
      project: taskapp
      component: database
      managed-by: docker-compose
```

```bash
docker compose down -v            # remove old volume first
docker compose up -d              # recreate with metadata version
docker volume ls | grep taskapp
```
```
local   taskapp-db-data           ← explicit name used — no project prefix ✅
```

```bash
docker volume inspect taskapp-db-data
```
```json
[
  {
    "Name": "taskapp-db-data",
    "Driver": "local",
    "Mountpoint": "/var/lib/docker/volumes/taskapp-db-data/_data",
    "Labels": {
      "component": "database",
      "managed-by": "docker-compose",
      "project": "taskapp"
    },
    "Scope": "local"
  }
]
```

Labels are now present as defined. You can also filter volumes by label:

```bash
docker volume ls --filter label=project=taskapp
```
```
local   taskapp-db-data   ← only volumes with this label returned ✅
```


---

### Step 7: Connect to MySQL and Verify Database

```bash
docker exec -it taskapp-mysql mysql -u root -pdbpassword11
```

```sql
-- Verify database was created from MYSQL_DATABASE env var
SHOW DATABASES;
```
```
+--------------------+
| Database           |
+--------------------+
| information_schema |
| mysql              |
| performance_schema |
| sys                |
| taskappdb          |    ← ✅ created from MYSQL_DATABASE env var
+--------------------+
```

```sql
-- Exit MySQL
EXIT;
```

---

### Step 8: `docker compose down` vs `down -v`

```bash
# Stop and remove containers + network — volume is preserved
docker compose down
```
```
[+] Running 2/2
 ✔ Container taskapp-mysql   Removed
 ✔ Network taskapp_default   Removed
```

```bash
# Volume is still present — data is safe
docker volume ls | grep taskapp
```
```
local   taskapp_db-data   ← ✅ volume preserved (auto-named)
```

```bash
# Bring back up — volume is reused, data is intact
docker compose up -d
docker exec -it taskapp-mysql mysql -u root -pdbpassword11 -e "SHOW DATABASES;"
```
```
taskappdb   ← ✅ still there, data persisted across down/up
```

```bash
# Stop and remove everything including volume
docker compose down -v
```
```
[+] Running 3/3
 ✔ Container taskapp-mysql    Removed
 ✔ Volume taskapp_db-data     Removed   ← volume deleted
 ✔ Network taskapp_default    Removed
```

```
docker compose down          →  removes containers + network. Volume PRESERVED ✅
docker compose down -v       →  removes containers + network + volumes ❌
```

> **Production rule:** Never run `docker compose down -v` on a database unless you intend to wipe all data.

---

### Step 9: Without `-d` — See What It Looks Like

```bash
# Start without -d — terminal is blocked
docker compose up
```
```
Attaching to taskapp-mysql
taskapp-mysql  | 2025-01-01T00:00:01 [Note]: MySQL started...
taskapp-mysql  | ...   ← terminal is blocked here
                        Ctrl+C stops ALL containers
```

> This is why `-d` is always used — `Ctrl+C` in a session accidentally stops your entire stack.

```bash
# Stop it and restart in detached mode
docker compose down
docker compose up -d
```

---

### Step 10: Cleanup

```bash
docker compose down -v
```

---

## Compose Command Reference

| Command | What it does |
|---|---|
| `docker compose up -d` | Create and start all services in detached mode |
| `docker compose down` | Stop and remove containers and networks |
| `docker compose down -v` | Stop and remove containers, networks AND volumes |
| `docker compose ps` | List running services |
| `docker compose logs` | View logs for all services |
| `docker compose logs -f <service>` | Follow logs for a specific service |
| `docker compose stop` | Stop containers without removing them |
| `docker compose start` | Start previously stopped containers |
| `docker compose restart` | Restart running containers |

---

## Key Takeaways

| Concept | Key Point |
|---|---|
| `docker compose` | Always use V2 with a space — `docker-compose` (hyphen) is deprecated |
| `version:` field | Omit entirely — obsolete in Compose V2, produces warnings |
| `compose.yaml` | Official recommended filename |
| Default network | Auto-created per project — services reach each other by service name |
| Volume auto-naming | Without `name:`, Compose generates `<project>_<ref-name>` e.g. `taskapp_db-data` |
| `name:` in volume | Optional — overrides auto-naming, gives full control over exact volume name |
| Volume labels | Metadata for management — `docker volume ls --filter label=project=taskapp` |
| `restart: unless-stopped` | Best general-purpose production policy |
| `docker compose down` | Preserves volumes — data is safe |
| `docker compose down -v` | Destroys volumes — use with caution |
| Service name in logs | Use service name (`db`) not container name (`taskapp-mysql`) with Compose commands |
