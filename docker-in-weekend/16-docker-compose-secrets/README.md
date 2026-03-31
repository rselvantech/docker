# Docker Compose Secrets — Secure Credential Management

## Overview

In previous demos, passwords were stored in `.env` files and injected as environment variables. Environment variables are readable by any process in the container, printed in logs, and visible in `docker inspect`. Secrets solve this — credentials are mounted as files inside the container, never exposed as environment variables.

**What you'll learn:**
- Why env vars are insufficient for credentials
- `secrets:` top-level key — declare secret sources (files)
- `secrets:` service-level key — grant a service access to specific secrets
- How secrets are mounted — `/run/secrets/<secret_name>`
- `_FILE` environment variable convention — how MySQL and WordPress consume secrets
- `docker compose exec` to verify secrets are mounted correctly
- What secrets protect against vs what they don't

---

## Project Structure

```
16-docker-compose-secrets/
├── src/
│   ├── secrets/
│   │   ├── db_root_password.txt     # MySQL root password
│   │   └── db_password.txt          # WordPress DB user password
│   ├── .gitignore
│   └── compose.yaml
└── README.md
```

**Stack:** WordPress + MySQL — same as Demo 12, but passwords moved to secret files.

---

## Why Environment Variables Are Not Enough for Credentials

```
Problem with env vars:
──────────────────────
docker inspect <container>   → shows all env vars including passwords in plain text
docker logs <container>      → some apps print env vars on startup/crash
ps aux inside container      → some processes expose env vars in process list
docker exec <c> env          → any user who can exec can read all env vars

Secrets solve this:
───────────────────
Mounted as files in /run/secrets/<name>   → not in env vars
tmpfs mount — never written to disk       → not in container filesystem layer
Not visible in docker inspect env section → not in metadata
Each service only sees secrets granted to it → least-privilege access
```

---

## How Compose Secrets Work

```
1. Create a secret file on host:
   echo "mysecretpassword" > secrets/db_password.txt

2. Declare it in compose.yaml top-level secrets:
   secrets:
     db_password:
       file: ./secrets/db_password.txt    ← Compose reads this file

3. Grant service access:
   services:
     db:
       secrets:
         - db_password                    ← service can now read this secret

4. Inside the container, secret is mounted at:
   /run/secrets/db_password              ← contains the password string

5. Tell MySQL/WordPress where to find it:
   environment:
     MYSQL_PASSWORD_FILE: /run/secrets/db_password   ← _FILE suffix convention
```

---

## Application Files

### Step 1: Create Secret Files

```bash
mkdir -p 16-docker-compose-secrets/src/secrets
cd 16-docker-compose-secrets/src

echo "rootpassword11" > secrets/db_root_password.txt
echo "wppassword11"   > secrets/db_password.txt
```

> **Important:** Secret files contain only the password — no quotes, no trailing newline issues. Use `echo` (adds newline) or `printf` (no newline): `printf "wppassword11" > secrets/db_password.txt`

### `src/.gitignore`
```
secrets/
```

Secret files must never be committed to version control. Add the entire `secrets/` directory to `.gitignore`.

---

## `compose.yaml`

**`src/compose.yaml`**

```yaml
name: secretsdemo

services:

  db:
    image: mysql:8.4
    container_name: secretsdemo-mysql
    restart: always
    environment:
      MYSQL_DATABASE: wpdb
      MYSQL_USER: wpuser
      # _FILE suffix — MySQL reads the password from this file path
      MYSQL_ROOT_PASSWORD_FILE: /run/secrets/db_root_password
      MYSQL_PASSWORD_FILE: /run/secrets/db_password
    secrets:
      - db_root_password          # grants access to this secret
      - db_password               # grants access to this secret
    volumes:
      - db-data:/var/lib/mysql
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost", "-u", "root",
             "--password=$(cat /run/secrets/db_root_password)"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s

  wordpress:
    image: wordpress:6.9.4
    container_name: secretsdemo-wordpress
    restart: unless-stopped
    environment:
      WORDPRESS_DB_HOST: db
      WORDPRESS_DB_USER: wpuser
      WORDPRESS_DB_NAME: wpdb
      # _FILE suffix — WordPress reads the password from this file path
      WORDPRESS_DB_PASSWORD_FILE: /run/secrets/db_password
    secrets:
      - db_password               # only needs the user password, not root
    ports:
      - "8080:80"
    volumes:
      - wp-data:/var/www/html
    depends_on:
      db:
        condition: service_healthy

# Top-level secrets — declare sources
secrets:
  db_root_password:
    file: ./secrets/db_root_password.txt    # path to secret file on host
  db_password:
    file: ./secrets/db_password.txt

volumes:
  db-data:
  wp-data:
```

---

## Compose File Explained

### Top-Level `secrets:` — Declaration

```yaml
secrets:
  db_root_password:
    file: ./secrets/db_root_password.txt   # Compose reads this file's contents
  db_password:
    file: ./secrets/db_password.txt
```

This declares the secrets and their sources. Only `file:` source is supported in standalone Compose. Each named secret can be granted to one or more services.

### Service-Level `secrets:` — Access Grant

```yaml
db:
  secrets:
    - db_root_password    # db container gets /run/secrets/db_root_password
    - db_password         # db container gets /run/secrets/db_password

wordpress:
  secrets:
    - db_password         # wordpress only gets /run/secrets/db_password
                          # wordpress cannot read db_root_password ← least privilege ✅
```

Each service only sees the secrets explicitly granted to it. `wordpress` has no access to `db_root_password`.

### `_FILE` Environment Variable Convention

MySQL and WordPress official images support `_FILE` suffixed env vars:

```
Standard:   MYSQL_ROOT_PASSWORD=mypassword       → password inline in compose.yaml ❌
With FILE:  MYSQL_ROOT_PASSWORD_FILE=/run/secrets/db_root_password → read from file ✅
```

The `_FILE` convention is supported by most Docker Official Images including MySQL, PostgreSQL, Redis, WordPress, and MariaDB. Check the image's Docker Hub documentation for supported `_FILE` vars.

---

## Lab Instructions

### Step 2: Start the Stack

```bash
docker compose up -d
```
```
[+] Running 5/5
 ✔ Network secretsdemo_default       Created
 ✔ Volume "secretsdemo_db-data"      Created
 ✔ Volume "secretsdemo_wp-data"      Created
 ✔ Container secretsdemo-mysql       Started
 ✔ Container secretsdemo-wordpress   Started
```

### Step 3: Access WordPress

Open `http://localhost:8080` and complete the WordPress setup wizard. WordPress successfully connected to MySQL using the secret password — without it ever appearing in an env var ✅

### Step 4: Verify Secrets Are Mounted as Files

```bash
# Connect to the wordpress container
docker compose exec wordpress bash

# List the secrets directory
ls /run/secrets/
```
```
db_password      ← secret file mounted here ✅
```

```bash
# Read the secret value
cat /run/secrets/db_password
```
```
wppassword11
```

```bash
# Verify db_root_password is NOT accessible to wordpress
cat /run/secrets/db_root_password
```
```
cat: /run/secrets/db_root_password: No such file or directory   ← not granted ✅
```

```bash
exit
```

### Step 5: Verify Secret Is NOT in Environment Variables

```bash
# Check — password should NOT appear in env vars
docker compose exec wordpress env | grep -i password
```
```
WORDPRESS_DB_PASSWORD_FILE=/run/secrets/db_password   ← only the path, not the value ✅
```

Compare to the old `.env` approach:
```
# Old .env approach — password visible:
WORDPRESS_DB_PASSWORD=wppassword11   ← plain text in env ❌

# Secrets approach — only file path:
WORDPRESS_DB_PASSWORD_FILE=/run/secrets/db_password   ← path only ✅
```

### Step 6: Verify Secrets Are Not Visible in `docker inspect`

```bash
docker inspect secretsdemo-wordpress | grep -A5 "Env"
```
```json
"Env": [
    "WORDPRESS_DB_HOST=db",
    "WORDPRESS_DB_USER=wpuser",
    "WORDPRESS_DB_NAME=wpdb",
    "WORDPRESS_DB_PASSWORD_FILE=/run/secrets/db_password"   ← path only, not value ✅
]
```

The actual password `wppassword11` does not appear anywhere in `docker inspect` output.

### Step 7: Check MySQL Also Has Both Secrets

```bash
docker compose exec db ls /run/secrets/
```
```
db_password
db_root_password   ← db has both secrets ✅
```

### Step 8: Cleanup

```bash
docker compose down -v
```

---

## What Secrets Protect Against (and What They Don't)

```
Secrets DO protect against:
✅ Passwords visible in docker inspect
✅ Passwords printed in container logs
✅ Passwords readable via `env` command inside container
✅ Accidental git commits of credentials (with .gitignore)
✅ Cross-service credential leakage (least privilege)

Secrets DO NOT protect against:
⚠️ Someone with shell access to the container reading /run/secrets/
⚠️ The secret file on the host being readable by other users
⚠️ The application itself logging the password it reads from the file
```

For production-grade secret management, use external secret stores (HashiCorp Vault, AWS Secrets Manager, Azure Key Vault) and inject them into Docker secrets at runtime.

---

## Key Takeaways

| Concept | Key Point |
|---|---|
| Top-level `secrets:` | Declares secrets and their source files |
| Service-level `secrets:` | Grants a service access to specific secrets |
| Mount path | Secrets mounted at `/run/secrets/<secret_name>` inside container |
| `_FILE` convention | `MYSQL_PASSWORD_FILE=/run/secrets/...` — official images read password from this path |
| Least privilege | Each service only sees secrets explicitly granted to it |
| `secrets/` in `.gitignore` | Secret files must never be committed to version control |
| Not in env vars | Secret value never appears in `docker inspect` or `env` output |
| `file:` source | Only source type in standalone Compose — Docker Swarm supports additional sources |