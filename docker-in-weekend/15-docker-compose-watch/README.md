# Docker Compose Develop Watch — `sync`, `sync+restart`, `rebuild`

## Overview

Every time you change code during development, the traditional workflow is: stop the stack → rebuild the image → restart containers → test → repeat. Compose Watch eliminates this cycle. It monitors files on your host and automatically syncs, restarts, or rebuilds based on rules you define — keeping your container up to date as you code.

**What you'll learn:**
- `develop: watch:` block in `compose.yaml`
- Three watch actions — `sync`, `sync+restart`, `rebuild`
- `path:`, `target:`, `ignore:` watch rule fields
- `docker compose up --watch` — start with file watching enabled
- `docker compose watch` — start watch on already-running stack
- When to use each action
- `sync+exec` — brief theory (newest action, v2.29+)

---

## Project Structure

```
15-docker-compose-watch/
├── src/
│   ├── html/
│   │   └── index.html       # static content — watched with sync
│   ├── nginx.conf           # Nginx config — watched with sync+restart
│   ├── Dockerfile           # Dockerfile
│   └── compose.yaml
└── README.md
```

Nginx serves static HTML. Changing `index.html` should instantly appear in the browser (sync). Changing `nginx.conf` requires a container restart to apply (sync+restart).

---

## Application Files

**`src/html/index.html`**
```html
<!DOCTYPE html>
<html>
  <head><title>Compose Watch Demo</title></head>
  <body>
    <h1>Compose Watch — v1</h1>
    <p>Edit this file and watch it update live in the container.</p>
  </body>
</html>
```

**`src/nginx.conf`**
```nginx
server {
    listen 80;
    location / {
        root /usr/share/nginx/html;
        index index.html;
        # autoindex off;     ← uncomment this in the lab to trigger sync+restart
    }
}
```

**`src/Dockerfile`**
```dockerfile
FROM nginx:1.29-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY html/ /usr/share/nginx/html/

EXPOSE 80
```

---

## `compose.yaml`

**`src/compose.yaml`**

```yaml
name: watchdemo

services:
  web:
    build:
      context: .
    container_name: watchdemo-web
    ports:
      - "8080:80"
    develop:
      watch:
        # Action 1: sync — copy changed files into running container instantly
        - action: sync
          path: ./html                          # watch this local directory
          target: /usr/share/nginx/html         # sync into this container path
          ignore:
            - "*.md"                            # skip markdown files

        # Action 2: sync+restart — sync file then restart the container
        - action: sync+restart
          path: ./nginx.conf                    # watch this config file
          target: /etc/nginx/conf.d/default.conf # sync into container, then restart
```

---

## Watch Actions Explained

### `sync` — File Sync Without Restart

```
Local change detected → file copied into running container → immediately active
No image rebuild      → no container restart               → fastest possible update
```

Best for: static files, templates, interpreted source code (Python, PHP, JS with hot-reload).

```yaml
- action: sync
  path: ./html                       # local path to watch (directory or file)
  target: /usr/share/nginx/html      # where to copy inside the container
  ignore:
    - "*.md"                         # patterns to exclude from watching
```

### `sync+restart` — Sync Then Restart Container

```
Local change detected → file copied into running container → container restarts
No image rebuild      → restart applies new config         → slightly slower than sync
```

Best for: config files that the process reads on startup (nginx.conf, database config, .env).

```yaml
- action: sync+restart
  path: ./nginx.conf
  target: /etc/nginx/conf.d/default.conf
  # no 'ignore' needed — watching a single file
```

### `rebuild` — Full Image Rebuild

```
Local change detected → image rebuilt with BuildKit → container recreated with new image
Slowest action        → use for dependency files, Dockerfiles, compiled code
```

Best for: `package.json`, `requirements.txt`, `Dockerfile`, compiled language source files.

```yaml
- action: rebuild
  path: ./Dockerfile               # rebuild when Dockerfile changes
```

### Action Comparison

```
Action          File synced?   Container restarts?   Image rebuilt?   Speed
─────────────────────────────────────────────────────────────────────────────
sync            ✅ Yes         ❌ No                 ❌ No            ⚡ Fastest
sync+restart    ✅ Yes         ✅ Yes                ❌ No            🔄 Medium
rebuild         ✅ (implicit)  ✅ Yes (new image)    ✅ Yes           🐢 Slowest
```

### `sync+exec` — Theory (Compose v2.29+)

The newest action. Syncs files then runs a command inside the container instead of restarting the whole process. Useful for graceful config reloads (e.g. `nginx -s reload` instead of a full restart):

```yaml
- action: sync+exec
  path: ./nginx.conf
  target: /etc/nginx/conf.d/default.conf
  exec:
    command: ["nginx", "-s", "reload"]   # run inside container after sync
```

Not widely available yet — requires Compose v2.29+. Use `sync+restart` for now.

---

## Watch Rule Fields

| Field | Required | Description |
|---|---|---|
| `action` | ✅ Yes | `sync`, `sync+restart`, or `rebuild` |
| `path` | ✅ Yes | Local path to watch (file or directory) |
| `target` | ✅ for `sync`/`sync+restart` | Path inside container to copy files to |
| `ignore` | ❌ Optional | List of patterns to exclude |

---

## Lab Instructions

### Step 1: Create Project Files

```bash
mkdir -p 15-docker-compose-watch/src/html
cd 15-docker-compose-watch/src
```

Create all files as shown above.

---

### Step 2: Start with Watch Mode

```bash
docker compose up --watch
```

> **`--watch` vs `-d`:** `--watch` runs in attached mode so you can see watch events in the terminal. Do not use `-d` here — you need to see the watch output.

```
[+] Building 2.1s (7/7) FINISHED
[+] Running 2/2
 ✔ Network watchdemo_default   Created
 ✔ Container watchdemo-web     Started
[+] Watching enabled
 ! watchdemo-web  Watching for file changes...
```

Open `http://localhost:8080` in a browser — you should see **Compose Watch — v1**.

Leave this terminal running with watch output visible. Open a second terminal for edits.

---

### Step 3: Test `sync` — Edit Static HTML

In a second terminal, edit `src/html/index.html`:

Change:
```html
<h1>Compose Watch — v1</h1>
```

To:
```html
<h1>Compose Watch — v2 (synced live!)</h1>
```

Save the file. Watch the first terminal:

```
 ✔ watchdemo-web  Synced: html/index.html → /usr/share/nginx/html/index.html
```

Refresh `http://localhost:8080` — **v2 appears immediately** with no restart ✅

What happened:
```
1. Compose detected index.html changed
2. Copied the updated file into the running container
3. Container kept running — no restart
4. Nginx served the new file on next request
```

---

### Step 4: Test `sync+restart` — Edit Nginx Config

Edit `src/nginx.conf` — uncomment the `autoindex off` line:

```nginx
server {
    listen 80;
    location / {
        root /usr/share/nginx/html;
        index index.html;
        autoindex off;     # ← uncomment this line
    }
}
```

Save the file. Watch the first terminal:

```
 ✔ watchdemo-web  Synced: nginx.conf → /etc/nginx/conf.d/default.conf
 ✔ watchdemo-web  Restarting container watchdemo-web
 ✔ watchdemo-web  Container restarted
```

What happened:
```
1. Compose detected nginx.conf changed
2. Copied the updated config into the container
3. Restarted the container — Nginx reloaded the config on startup
4. New config is active
```

Refresh `http://localhost:8080` — site still works ✅ and Nginx is now using the updated config.

---

### Step 5: Stop Watch Mode

Press `Ctrl+C` in the watch terminal:
```
^CGracefully stopping...
[+] Stopping 1/1
 ✔ Container watchdemo-web   Stopped
```

`Ctrl+C` stops both the watch session AND the containers —
same behavior as `docker compose up` without `--watch`.
```bash
# Containers are stopped
docker compose ps -a
```
```
NAME             STATUS
watchdemo-web    Exited (0)
```

To restart with watch mode again:
```bash
docker compose up --watch
```

To fully remove containers:
```bash
docker compose down
```

---

### Step 6: Watch on an Already-Running Stack

If the stack is already running (started with `docker compose up -d`), you can start watch separately:

```bash
docker compose up -d           # start normally first
docker compose watch           # attach watch to the running stack
```

`docker compose watch` attaches to an already-running stack without restarting anything.

---

## `--watch` on Multiple Services

Watch rules can be defined per service. Each service watches its own paths independently:

```yaml
services:
  web:
    build: ./web
    develop:
      watch:
        - action: sync
          path: ./web/static
          target: /app/static
        - action: rebuild
          path: ./web/package.json

  api:
    build: ./api
    develop:
      watch:
        - action: sync+restart
          path: ./api/config.yaml
          target: /app/config.yaml
```

When `./web/static/` changes → `web` syncs. When `./api/config.yaml` changes → `api` syncs and restarts. Each service reacts independently.

---

## When to Use Each Action

```
File type                    Action           Why
───────────────────────────────────────────────────────────────────────
HTML, CSS, JS (static)       sync             No restart needed — Nginx serves from disk
Python / PHP source          sync             Interpreted — process reads from disk
Config files (nginx, db)     sync+restart     Process must restart to re-read config
package.json / Dockerfile    rebuild          Dependencies require a new image layer
Go / Java / C source         rebuild          Compiled — must rebuild binary
requirements.txt             rebuild          New packages require pip install in image
```

---

## Key Takeaways

| Concept | Key Point |
|---|---|
| `develop: watch:` | Defines file watching rules per service in compose.yaml |
| `action: sync` | Copies changed files into the running container — no restart, fastest |
| `action: sync+restart` | Syncs file then restarts the container — for config files |
| `action: rebuild` | Full image rebuild and container recreation — for dependencies or Dockerfiles |
| `path:` | Local file or directory to watch |
| `target:` | Destination path inside the container |
| `ignore:` | Patterns to skip — always ignore `node_modules/`, build artifacts |
| `docker compose up --watch` | Start stack with watch mode in attached terminal |
| `docker compose watch` | Attach watch to an already-running stack |
| `sync+exec` (v2.29+) | Newest action — sync then run a command (e.g. graceful reload) instead of full restart |
