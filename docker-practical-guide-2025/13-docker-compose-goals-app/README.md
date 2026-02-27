# Docker Compose - Multi-Container Goals Application Lab

## Lab Overview

This hands-on lab demonstrates how to use **Docker Compose v2** to simplify multi-container application management. Building upon [Demo 12: Multi-Container Goals App](../12-multi-container-goals-app/), you'll learn how to replace multiple `docker run` commands with a single, declarative configuration file, making your development workflow significantly more efficient and maintainable.

**What you'll do:**
- Convert Demo 12's docker run commands to docker-compose.yaml
- Use Docker Compose v2 modern syntax
- Configure services, volumes, networks, and environment variables
- Use build configurations for custom images
- Manage multi-container applications with single commands
- Leverage v2-specific features (watch mode, health checks, profiles)
- Learn Docker Compose best practices and common patterns

**Key Benefits of Docker Compose:**
- ✅ Single configuration file for entire application
- ✅ One command to start/stop all containers
- ✅ Automatic network creation and DNS resolution
- ✅ Easier volume management with relative paths
- ✅ Environment variable management simplified
- ✅ Perfect for development and testing environments

## Prerequisites

**Required Software:**
- Docker client and daemon installed and running
- Text editor or IDE
- Terminal with basic command knowledge

**Knowledge Requirements:**
- **REQUIRED:** Completion of [Demo 12: Multi-Container Goals App](../12-multi-container-goals-app/)
- Understanding of Docker images, containers, volumes, and networks
- Basic knowledge of YAML syntax helpful

**Docker Compose Version Check:**
```bash
# Check Docker Compose v2 (preferred - no hyphen)
docker compose version

# Expected output:
# Docker Compose version v2.40.2 (or higher)
```

**Important Version Notes:**
- **Docker Compose v2** is the current version (commands: `docker compose`)
- **Docker Compose v1** is deprecated (commands: `docker-compose`)
- This demo uses **Docker Compose v2 syntax**
- The `version` field in compose files is now **obsolete** and **ignored** (Compose Specification auto-detected)

## Lab Objectives

By the end of this lab, you will be able to:

1. ✅ Understand Docker Compose v2 architecture and benefits
2. ✅ Write docker-compose.yaml files with modern syntax
3. ✅ Convert docker run commands to Compose service definitions
4. ✅ Configure build contexts for custom images
5. ✅ Define service dependencies with depends_on
6. ✅ Use health checks and dependency conditions
7. ✅ Manage named volumes in Compose
8. ✅ Use environment files for configuration
9. ✅ Control service lifecycle with docker compose commands
10. ✅ Apply Compose v2 best practices

## From Docker Run to Docker Compose

### The Problem with Docker Run Commands

**In Demo 12, we needed 3 separate commands:**

```bash
# MongoDB
docker run -d \
  --name mongodb \
  --rm \
  --network goals-net \
  -v data:/data/db \
  -e MONGO_INITDB_ROOT_USERNAME=rselvantech \
  -e MONGO_INITDB_ROOT_PASSWORD=passWD \
  mongo

# Backend
docker run -d \
  --name goals-backend \
  --rm \
  --network goals-net \
  -p 80:80 \
  -v logs:/app/logs \
  -v $(pwd)/backend:/app \
  -v /app/node_modules \
  -e MONGODB_USERNAME=rselvantech \
  -e MONGODB_PASSWORD=passWD \
  goals-node

# Frontend
docker run -d \
  --name goals-frontend \
  --rm \
  -p 3000:3000 \
  -v $(pwd)/frontend/src:/app/src \
  -it \
  goals-react
```

**Challenges:**
- ❌ Must remember and type 3 long commands
- ❌ Easy to make mistakes or forget options
- ❌ Hard to maintain and share with team
- ❌ Must create network manually first
- ❌ Must start containers in correct order
- ❌ Absolute paths required for bind mounts

### The Docker Compose Solution

**With Docker Compose v2, one file + one command:**

```yaml
# docker-compose.yaml
# No version field needed in Docker Compose v2!

services:
  mongodb:
    image: mongo
    volumes:
      - data:/data/db
    environment:
      MONGO_INITDB_ROOT_USERNAME: rselvantech
      MONGO_INITDB_ROOT_PASSWORD: passWD

  backend:
    build: ./src/backend
    ports:
      - "80:80"
    volumes:
      - logs:/app/logs
      - ./src/backend:/app
      - /app/node_modules
    env_file:
      - ./env/backend.env
    depends_on:
      - mongodb

  frontend:
    build: ./src/frontend
    ports:
      - "3000:3000"
    volumes:
      - ./src/frontend/src:/app/src
    stdin_open: true
    tty: true
    depends_on:
      - backend

volumes:
  data:
  logs:
```

**Start all services:**
```bash
docker compose up -d
```

**Stop all services:**
```bash
docker compose down
```

**Benefits:**
- ✅ Single configuration file
- ✅ Easy to read and modify
- ✅ Relative paths for bind mounts
- ✅ Automatic network creation
- ✅ Service dependency management
- ✅ Version controlled and shareable

## Docker Compose File Structure

### Anatomy of docker-compose.yaml

```yaml

services:                         # Container definitions
  service-name:                   # Your service name (used for DNS)
    image: image-name             # Pull from registry OR
    build: ./path                 # Build from Dockerfile
    ports:                        # Published ports
      - "host:container"
    volumes:                      # Volumes (named, bind, anonymous)
      - named-vol:/container/path
      - ./host/path:/container/path
      - /container/path
    environment:                  # Environment variables
      KEY: value
    env_file:                     # Or load from file
      - ./path/to/.env
    depends_on:                   # Service dependencies
      service:
        condition: service_healthy
    networks:                     # Custom networks (optional)
      - custom-network
    healthcheck:                  # Health check configuration
      test: ["CMD", "curl", "-f", "http://localhost"]
      interval: 30s
      timeout: 10s
      retries: 3

volumes:                          # Named volumes declaration
  named-vol:

networks:                         # Custom networks (optional)
  custom-network:
```

### YAML Syntax Rules

**Indentation:**
- Use **2 spaces** for each level (NOT tabs)
- Children indented 2 spaces from parent
- All siblings at same indentation level

```yaml
# ✅ Correct
services:
  mongodb:
    image: mongo
    volumes:
      - data:/data/db

# ❌ Wrong (inconsistent indentation)
services:
    mongodb:
  image: mongo
      volumes:
    - data:/data/db
```

**Key-Value Pairs:**
```yaml
# Format: key: value (space after colon required)
key: value              # ✅ Correct
key:value               # ❌ Wrong (no space)
key :value              # ❌ Wrong (space before colon)
```

**Lists:**
```yaml
# Single values: use dash
volumes:
  - data:/data/db       # Dash for list items
  - logs:/app/logs

# Key-value pairs: no dash
environment:
  KEY1: value1          # No dash for objects
  KEY2: value2
```

**Comments:**
```yaml
# This is a comment
services:               # Inline comment
  mongodb:
    image: mongo        # Container image
```

## Lab Instructions

### Step 1: Project Setup

**1.1 Copy Demo 12 project:**

```bash
# Create new directory for Compose version
mkdir -p 13-docker-compose-goals-app/src
cd 13-docker-compose-goals-app

# Copy Demo 12 source files
cp -r ../12-multi-container-goals-app/src/* ./src/
```

**1.2 Verify project structure:**

```bash
tree -L 3
```

**Expected:**
```
13-docker-compose-goals-app/
├── README.md
└── src/
    ├── backend/
    │   ├── Dockerfile
    │   ├── app.js
    │   ├── package.json
    │   ├── models/
    │   └── logs/
    └── frontend/
        ├── Dockerfile
        ├── package.json
        ├── public/
        └── src/
```

### Step 2: Create Environment Files

**2.1 Create env directory:**

```bash
mkdir -p env
```

**2.2 Create `env/backend.env`:**

```bash
cat > env/backend.env << 'EOF'
MONGODB_USERNAME=rselvantech
MONGODB_PASSWORD=passWD
EOF
```

**Note:** These match MongoDB initialization variables
**Note:** Add `*.env` entry in `.gitignorefile` , if not there already

### Step 3: Create Docker Compose File - Modern v2 Syntax

**3.1 Create `docker-compose.yaml` in project root:**

```bash
touch docker-compose.yaml
```

**3.2 Modern compose file structure (NO version field):**

```yaml
# docker-compose.yaml
# Docker Compose v2 - No version field needed!

services:
  # Services will be defined here
```

**Understanding the version field deprecation:**

```yaml
# ❌ OLD (Docker Compose v1 - deprecated)
version: "3.8"
services:
  mongodb:
    image: mongo

# ✅ NEW (Docker Compose v2 - current)
# No version field!
services:
  mongodb:
    image: mongo
```

**Why version is obsolete:**
- Docker Compose v2 uses the **Compose Specification** (not version numbers)
- Compose Specification is a living standard maintained by Docker
- All features available regardless of version field
- Version field is ignored if present (backward compatibility)
- Cleaner syntax without version tracking

**References:**
- Compose Specification: https://docs.docker.com/compose/compose-file/
- Migration guide: https://docs.docker.com/compose/migrate/

### Step 4: Configure MongoDB Service

**4.1 Add MongoDB service:**

```yaml
# docker-compose.yaml

services:
    mongodb:                            # Service name (DNS hostname)
        image: mongo                        # Use official mongo image
        volumes:                            # Volume configuration
            - data:/data/db                 # Named volume for persistence
        environment:                        # Environment variables
            MONGO_INITDB_ROOT_USERNAME: rselvantech
            MONGO_INITDB_ROOT_PASSWORD: passWD
```

**Key points:**
- `mongodb` = service name = DNS hostname in network
- No `--rm` needed (Compose handles cleanup with `down`)
- No `-d` needed (controlled by `docker compose up -d`)
- No `--network` needed (Compose creates default network)
- No port publishing (internal access only - more secure)

**Comparison to docker run:**
```bash
# Docker run (Demo 12) - 6 flags!
docker run -d --name mongodb --rm --network goals-net \
  -v data:/data/db \
  -e MONGO_INITDB_ROOT_USERNAME=rselvantech \
  -e MONGO_INITDB_ROOT_PASSWORD=passWD \
  mongo


### Step 5: Configure Backend Service

**5.1 Add backend service:**

```yaml
services:
  mongodb:
    # ... (previous MongoDB config)

  backend:
    build: ./src/backend
    ports:
      - "80:80"
    volumes:
      - logs:/app/logs
      - ./src/backend:/app
      - /app/node_modules
    env_file:
      - ./env/backend.env
    depends_on:
      - mongodb
```

**Understanding build:**

```yaml
build: ./src/backend
```

**Short form:**
- Points to directory containing Dockerfile
- Docker Compose finds and builds `Dockerfile`
- Equivalent to: `docker build ./src/backend`

**Long form (alternative):**
```yaml
build:
  context: ./src/backend          # Dockerfile location
  dockerfile: Dockerfile          # Dockerfile name (if different)
  args:                           # Build arguments
    NODE_VERSION: 25
```

**Understanding depends_on:**

```yaml
depends_on:
  - mongodb
```

**What it does:**
- Backend waits for MongoDB to start
- Docker Compose starts MongoDB first
- Then starts backend
- **Important:** Only waits for container start, not readiness!

**Startup order:**
```
1. MongoDB container starts
2. Compose waits for MongoDB process to begin
3. Backend container starts
4. Backend connects to MongoDB

Note: If MongoDB takes time to initialize,
backend might fail first connection attempt.
Application should have retry logic.
```

**Understanding volumes (3 types in one service):**

```yaml
volumes:
  - logs:/app/logs              # Named volume - log persistence
  - ./src/backend:/app          # Bind mount - live code updates
  - /app/node_modules           # Anonymous volume - protect deps
```

**Bind mount advantage in Compose:**
```bash
# Docker run requires absolute path:
-v /home/user/project/backend:/app

# Compose allows relative path:
- ./src/backend:/app
```

**Volume precedence (longer paths win):**
```
/app/node_modules    ← Highest (most specific)
/app/logs           ← Medium
/app                ← Lowest (least specific)

Result:
- /app gets host code (bind mount)
- /app/node_modules stays from container (anonymous volume)
- /app/logs persists in named volume
```

**Understanding env_file:**

```yaml
env_file:
  - ./env/backend.env
```

**Loads environment variables from file:**
```bash
# env/backend.env content:
MONGODB_USERNAME=rselvantech
MONGODB_PASSWORD=passWD

# Available in container as:
process.env.MONGODB_USERNAME  // "rselvantech"
process.env.MONGODB_PASSWORD  // "passWD"
```

**Alternative - inline environment:**
```yaml
# Option 1: Key-value pairs (no dash) - RECOMMENDED
environment:
  MONGODB_USERNAME: rselvantech
  MONGODB_PASSWORD: passWD

# Option 2: List format (with dash)
environment:
  - MONGODB_USERNAME=rselvantech
  - MONGODB_PASSWORD=passWD

# Option 3: From file (best for secrets)
env_file:
  - ./env/backend.env
```

### Step 6: Configure Frontend Service

**6.1 Add frontend service:**

```yaml
services:
  mongodb:
    # ... (MongoDB config)

  backend:
    # ... (Backend config)

  frontend:
    build: ./src/frontend
    ports:
      - "3000:3000"
    volumes:
      - ./src/frontend/src:/app/src
    stdin_open: true
    tty: true
    depends_on:
      - backend
```

**Understanding stdin_open and tty:**

```yaml
stdin_open: true    # Equivalent to: docker run -i
tty: true           # Equivalent to: docker run -t
```

**Why needed for React dev server:**
```
React development server expects interactive terminal
Without -it flags:
  - Dev server starts
  - Immediately detects no input
  - Shuts down thinking no one's using it

With stdin_open and tty:
  - Dev server starts
  - Keeps running (input available)
  - Hot module replacement works
```

**Why frontend depends_on backend:**
```yaml
depends_on:
  - backend
```

**Reasoning:**
- Frontend (React) makes API calls to backend
- Better UX if backend ready when frontend starts
- Not strictly required (frontend can handle backend unavailable)
- Demonstrates dependency chain: frontend → backend → mongodb

### Step 7: Declare Named Volumes

**7.1 Add volumes section at root level:**

```yaml
# docker-compose.yaml

services:
  mongodb:
    # ... services config ...

volumes:
  data:
  logs:
```

**Why declare named volumes?**

```yaml
# In services, we used:
mongodb:
  volumes:
    - data:/data/db      # Named volume "data"

backend:
  volumes:
    - logs:/app/logs     # Named volume "logs"

# Must declare at root level:
volumes:
  data:                  # Empty value = Docker manages it
  logs:                  # Empty value = Docker manages it
```

**What gets declared:**
- ✅ **Named volumes** - Must be declared
- ❌ **Bind mounts** - Don't declare (paths, not volumes)
- ❌ **Anonymous volumes** - Don't declare (unnamed)

**Volume sharing example:**
```yaml
# Same named volume used by multiple services:
services:
  app1:
    volumes:
      - shared-data:/data

  app2:
    volumes:
      - shared-data:/data    # Same volume!

volumes:
  shared-data:               # Shared between app1 and app2
```

### Step 8: Complete docker-compose.yaml

**8.1 Full basic configuration:**

```yaml
# docker-compose.yaml
# Docker Compose v2 - No version field needed!

services:
  mongodb:
    image: mongo
    volumes:
      - data:/data/db
    environment:
      MONGO_INITDB_ROOT_USERNAME: rselvantech
      MONGO_INITDB_ROOT_PASSWORD: passWD

  backend:
    build: ./src/backend
    ports:
      - "80:80"
    volumes:
      - logs:/app/logs
      - ./src/backend:/app
      - /app/node_modules
    env_file:
      - ./env/backend.env
    depends_on:
      - mongodb

  frontend:
    build: ./src/frontend
    ports:
      - "3000:3000"
    volumes:
      - ./src/frontend/src:/app/src
    stdin_open: true
    tty: true
    depends_on:
      - backend

volumes:
  data:
  logs:
```

**8.2 Verify YAML syntax:**

```bash
# Check for syntax errors
docker compose config

# Expected: Outputs parsed configuration (no errors)
```

✅ **docker-compose.yaml is complete!**

### Step 9: Start All Services

**9.1 Start in detached mode:**

```bash
docker compose up -d
```

**What happens:**

```
1. Creates network: 13-docker-compose-goals-app_default
2. Creates volumes: data, logs (if not exist)
3. Pulls mongo image (if not exists locally)
4. Builds backend image from ./src/backend/Dockerfile
5. Builds frontend image from ./src/frontend/Dockerfile
6. Starts MongoDB container
7. Waits for MongoDB to start
8. Starts backend container
9. Waits for backend to start
10. Starts frontend container
```

**Expected output:**
```
[+] Running 5/5
 ✔ Network 13-docker-compose-goals-app_default    Created
 ✔ Volume "13-docker-compose-goals-app_data"      Created
 ✔ Volume "13-docker-compose-goals-app_logs"      Created
 ✔ Container 13-docker-compose-goals-app-mongodb-1   Started
 ✔ Container 13-docker-compose-goals-app-backend-1   Started
 ✔ Container 13-docker-compose-goals-app-frontend-1  Started
```

**9.2 Verify all containers running:**

```bash
docker compose ps
```

**Expected output:**
```
NAME                                      IMAGE                               COMMAND                  STATUS
13-docker-compose-goals-app-backend-1     13-docker-compose-goals-app-backend  "docker-entrypoint.s…"   Up
13-docker-compose-goals-app-frontend-1    13-docker-compose-goals-app-frontend "docker-entrypoint.s…"   Up
13-docker-compose-goals-app-mongodb-1     mongo                               "docker-entrypoint.s…"   Up
```

✅ **All three services running!**

**9.3 Check logs:**

```bash
# All services
docker compose logs

# Specific service
docker compose logs backend

# Follow logs
docker compose logs -f backend
```

### Step 10: Test the Application

**10.1 Open in browser:**

```
http://localhost:3000
```

**Expected:** React application loads with empty goals list

**10.2 Add a goal:**

Type "Learn Docker Compose" and click "Add Goal"

**Expected:** Goal appears in list

**10.3 Verify data in backend logs:**

```bash
docker compose logs backend
```

**Expected output:**
```
backend-1   | TRYING TO STORE GOAL
backend-1   | STORED NEW GOAL
backend-1   | CONNECTED TO MONGODB!!
```

**10.4 Reload page:**

Refresh browser (Ctrl+R or Cmd+R)

**Expected:** Goal still appears (fetched from database)

**10.5 Delete goal:**

Click on the goal in the list

**Expected:** Goal removed from list

✅ **Full CRUD operations working!**

### Step 11: Test Data Persistence

**11.1 Add a new goal:**

Add "Master Multi-Container Apps with Compose"

**11.2 Stop all services:**

```bash
docker compose down
```

**What happens:**
```
[+] Running 4/4
 ✔ Container 13-docker-compose-goals-app-frontend-1  Removed
 ✔ Container 13-docker-compose-goals-app-backend-1   Removed
 ✔ Container 13-docker-compose-goals-app-mongodb-1   Removed
 ✔ Network 13-docker-compose-goals-app_default      Removed
```

**Note:** Volumes NOT removed (data persists!)

**11.3 Restart all services:**

```bash
docker compose up -d
```

**11.4 Open browser:**

```
http://localhost:3000
```

**Expected:** Goal "Master Multi-Container Apps with Compose" still appears!

✅ **Data persisted across container recreation!**

**Why?**
- Volumes NOT removed by `docker compose down`
- MongoDB data in named volume `data`
- Same volume reused on restart

### Step 12: Test Live Code Reloading

**12.1 Backend live reload:**

Edit `src/backend/app.js`:

```javascript
console.log('CONNECTED TO MONGODB!! - Compose works!');
```

**12.2 Check logs:**

```bash
docker compose logs -f backend
```

**Expected output:**
```
backend-1   | [nodemon] restarting due to changes...
backend-1   | [nodemon] starting `node app.js`
backend-1   | CONNECTED TO MONGODB!! - Compose works!
```

✅ **Backend auto-restart working!**

**12.3 Frontend live reload:**

Edit `src/frontend/src/App.js`:

```javascript
return (
  <div>
    <h1>Docker Compose Goals Tracker</h1>
    {error && <ErrorAlert errorText={error} />}
    <GoalInput onAddGoal={addGoalHandler} />
    {!isLoading && (
      <CourseGoals goals={loadedGoals} onDeleteGoal={deleteGoalHandler} />
    )}
  </div>
);
```

**12.4 Check browser:**

**Expected:** Heading appears automatically (hot reload)

✅ **Frontend hot module replacement working!**

### Step 13: Inspect Network and DNS

**13.1 View network details:**

```bash
docker compose exec backend cat /etc/hosts
```

**Expected output:**
```
127.0.0.1       localhost
172.18.0.3      abc123def456
172.18.0.2      mongodb
172.18.0.2      13-docker-compose-goals-app-mongodb-1
```

**13.2 Test DNS resolution:**

```bash
docker compose exec backend getent hosts mongodb
```

**Expected output:**
```
172.18.0.2      mongodb
```

✅ **Container DNS resolution working!**

### Step 14: Cleanup

**14.1 Stop containers (keep volumes):**

```bash
docker compose down
```

**What's removed:**
- ✅ All containers
- ✅ Default network
- ❌ Volumes (kept by default!)
- ❌ Images (never removed)

**14.2 Stop and remove volumes:**

```bash
docker compose down -v
```

**⚠️ Warning:** This deletes all data!

**14.3 Remove images too:**

```bash
docker compose down --rmi all
```

**Complete cleanup:**
```bash
docker compose down -v --rmi all --remove-orphans
```

## Advanced Configuration with Docker Compose v2 Features

### Enhanced docker-compose.yaml with v2 Features

```yaml
# docker-compose.yaml
# Docker Compose v2 with advanced features

services:
  mongodb:
    image: mongo:7.0
    container_name: goals-mongodb
    volumes:
      - data:/data/db
    environment:
      MONGO_INITDB_ROOT_USERNAME: rselvantech
      MONGO_INITDB_ROOT_PASSWORD: passWD
    healthcheck:
      test: ["CMD", "mongosh", "--eval", "db.adminCommand('ping')"]
      interval: 10s
      timeout: 5s
      retries: 3
      start_period: 30s
    networks:
      - goals-network
    restart: unless-stopped

  backend:
    build:
      context: ./src/backend
      dockerfile: Dockerfile
    container_name: goals-backend
    ports:
      - "80:80"
    volumes:
      - logs:/app/logs
      - ./src/backend:/app
      - /app/node_modules
    env_file:
      - ./env/backend.env
    depends_on:
      mongodb:
        condition: service_healthy    # v2: wait for health check
        restart: true                 # v2: restart if mongodb restarts
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:80/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    networks:
      - goals-network
    restart: unless-stopped

  frontend:
    build:
      context: ./src/frontend
      dockerfile: Dockerfile
    container_name: goals-frontend
    ports:
      - "3000:3000"
    volumes:
      - ./src/frontend/src:/app/src
    stdin_open: true
    tty: true
    depends_on:
      backend:
        condition: service_healthy
    networks:
      - goals-network
    restart: unless-stopped

volumes:
  data:
    name: goals-mongodb-data
  logs:
    name: goals-backend-logs

networks:
  goals-network:
    name: goals-network
    driver: bridge
```

**New features explained:**

**1. Health checks with conditions:**
```yaml
depends_on:
  mongodb:
    condition: service_healthy    # Wait for health check to pass
    restart: true                 # Restart this if mongodb restarts
```

**2. Container names:**
```yaml
container_name: goals-mongodb     # Custom name instead of auto-generated
```

**3. Named volumes and networks:**
```yaml
volumes:
  data:
    name: goals-mongodb-data      # Custom volume name

networks:
  goals-network:
    name: goals-network           # Custom network name
```

**4. Restart policies:**
```yaml
restart: unless-stopped           # Auto-restart unless manually stopped
# Options: no, always, on-failure, unless-stopped
```

## Understanding Container Naming

### Auto-Generated Container Names

**Pattern:** `{project}_{service}_{replica}`

```
13-docker-compose-goals-app_mongodb_1
├─┬────────────────────┬──────────┬─┤
│ Project folder       Service   Replica
```

**Project name sources:**
1. Directory name containing docker-compose.yaml
2. `-p` flag: `docker compose -p myproject up`
3. `COMPOSE_PROJECT_NAME` environment variable
4. `name` field at top level (Compose v2)

**Service Names vs Container Names:**

```yaml
services:
  mongodb:              # Service name (use in depends_on, DNS)
    # ...

# Auto-generated container name:
# 13-docker-compose-goals-app_mongodb_1

# DNS Resolution works with BOTH:
# - mongodb (service name)
# - 13-docker-compose-goals-app_mongodb_1 (container name)
```

**Custom container names:**

```yaml
services:
  mongodb:
    container_name: my-custom-mongodb    # Override auto-generation
```

**⚠️ Note:** Custom names prevent scaling (`--scale`)

## Docker Compose v2 Commands Reference

### Essential Commands

```bash
# Start all services (builds if needed)
docker compose up

# Start in detached mode
docker compose up -d

# Force rebuild images before starting
docker compose up --build

# Pull images without starting
docker compose pull

# Build images only (don't start)
docker compose build

# Build without cache
docker compose build --no-cache

# Stop and remove containers + network
docker compose down

# Stop and remove containers, network, and volumes
docker compose down -v

# Stop and remove everything including images
docker compose down -v --rmi all

# View running services
docker compose ps

# View all services (including stopped)
docker compose ps -a

# View logs (all services)
docker compose logs

# Follow logs
docker compose logs -f

# Follow logs for specific service
docker compose logs -f backend

# View logs with timestamps
docker compose logs -t

# View last N lines
docker compose logs --tail=100

# Execute command in running service
docker compose exec backend sh

# Execute without TTY
docker compose exec -T backend env

# Run one-off command (creates new container)
docker compose run backend npm test

# Run and remove container after
docker compose run --rm backend npm install

# Stop services (keep containers)
docker compose stop

# Start stopped services
docker compose start

# Restart services
docker compose restart

# Restart specific service
docker compose restart backend

# Pause services
docker compose pause

# Unpause services
docker compose unpause

# View resource usage
docker compose top

# Validate and view config
docker compose config

# View config with resolved variables
docker compose config --resolve-image-digests

# View which files compose is using
docker compose config --files

# Remove stopped containers
docker compose rm

# Remove without confirmation
docker compose rm -f

# View events from containers
docker compose events

# View port mapping
docker compose port backend 80
```

### Working with Specific Services

```bash
# Start only specific service(s)
docker compose up mongodb

# Start without dependencies
docker compose up --no-deps backend

# Build specific service
docker compose build backend

# Rebuild without cache
docker compose build --no-cache frontend

# View logs for specific service
docker compose logs backend

# Follow logs for multiple services
docker compose logs -f backend mongodb

# Execute in specific service
docker compose exec mongodb mongosh

# Run command in new container
docker compose run --rm backend npm install

# Scale service (no container_name)
docker compose up -d --scale backend=3

# Force recreate specific service
docker compose up -d --force-recreate backend
```

### Useful Flags

```bash
# docker compose up:
-d, --detach              # Detached mode
--build                   # Force rebuild
--no-build                # Don't build
--pull always             # Always pull images
--force-recreate          # Recreate all containers
--no-recreate             # Don't recreate
--no-deps                 # Don't start dependencies
--remove-orphans          # Remove old containers
--scale SERVICE=N         # Scale to N instances
--exit-code-from SERVICE  # Return exit code of SERVICE
--abort-on-container-exit # Stop if any exits

# docker compose down:
-v, --volumes             # Remove volumes
--rmi all                 # Remove all images
--rmi local               # Remove local images
--remove-orphans          # Remove orphans
-t, --timeout N           # Shutdown timeout (default: 10s)

# docker compose logs:
-f, --follow              # Follow output
--tail=N                  # Show last N lines
-t, --timestamps          # Show timestamps
--no-color                # No color
--no-log-prefix           # No service prefix

# docker compose exec:
-d, --detach              # Detached
-T                        # No pseudo-TTY
-e, --env KEY=VAL         # Set environment
-u, --user USER           # Run as user
-w, --workdir DIR         # Working directory
--index=N                 # Instance index
```

## Docker Compose vs Docker Run Comparison

### Complete Comparison Table

| Feature | Docker Run | Docker Compose v2 |
|---------|-----------|-------------------|
| **Configuration** | Command line | YAML file |
| **Multi-container** | Multiple commands | Single command |
| **Volume paths** | Absolute required | Relative paths OK |
| **Network creation** | Manual (`docker network create`) | Automatic |
| **Service dependencies** | Manual ordering | `depends_on` |
| **Health checks** | `--health-cmd` flag | `healthcheck:` section |
| **Environment variables** | `-e` or `--env-file` | `environment:` or `env_file:` |
| **Build images** | `docker build` separately | Integrated `build:` |
| **Start services** | `docker run` for each | `docker compose up` |
| **Stop services** | `docker stop` for each | `docker compose down` |
| **View logs** | `docker logs <name>` | `docker compose logs` |
| **Maintenance** | Remember long commands | Edit YAML file |
| **Sharing** | Share shell scripts | Share one YAML file |
| **Version control** | Scripts in repo | docker-compose.yaml |
| **Interactive mode** | `-it` flags | `stdin_open` + `tty` |

### Side-by-Side Example

**Docker Run (3 commands + network):**
```bash
# Create network
docker network create goals-net

# MongoDB
docker run -d --name mongodb --rm --network goals-net \
  -v data:/data/db \
  -e MONGO_INITDB_ROOT_USERNAME=rselvantech \
  -e MONGO_INITDB_ROOT_PASSWORD=passWD \
  mongo

# Backend
docker run -d --name goals-backend --rm --network goals-net \
  -p 80:80 \
  -v logs:/app/logs \
  -v $(pwd)/backend:/app \
  -v /app/node_modules \
  -e MONGODB_USERNAME=rselvantech \
  -e MONGODB_PASSWORD=passWD \
  goals-node

# Frontend
docker run -d --name goals-frontend --rm \
  -p 3000:3000 \
  -v $(pwd)/frontend/src:/app/src \
  -it \
  goals-react
```

**Docker Compose v2 (1 file + 1 command):**
```yaml
# docker-compose.yaml
services:
  mongodb:
    image: mongo
    volumes:
      - data:/data/db
    environment:
      MONGO_INITDB_ROOT_USERNAME: rselvantech
      MONGO_INITDB_ROOT_PASSWORD: passWD
  backend:
    build: ./backend
    ports:
      - "80:80"
    volumes:
      - logs:/app/logs
      - ./backend:/app
      - /app/node_modules
    env_file:
      - ./env/backend.env
    depends_on:
      - mongodb
  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    volumes:
      - ./frontend/src:/app/src
    stdin_open: true
    tty: true
volumes:
  data:
  logs:
```

```bash
docker compose up -d
```

**Lines of configuration:**
- Docker run: ~25 lines (commands + flags)
- Docker Compose: ~20 lines (YAML) + 1 command

**Readability:** Docker Compose wins! ✅

## Troubleshooting

### Syntax Errors

**Problem:** YAML syntax error

```bash
docker compose up
# Error: yaml: line 10: mapping values are not allowed
```

**Solution:**
```bash
# Validate syntax
docker compose config

# Common issues:
# - Missing spaces after colons
# - Inconsistent indentation (use 2 spaces)
# - Tabs instead of spaces
# - Missing quotes around ports
```

**Example fixes:**
```yaml
# ❌ Wrong
services:
  backend:
    ports:
      - 80:80          # Error: needs quotes

# ✅ Correct
services:
  backend:
    ports:
      - "80:80"        # Quoted
```

### Build Failures

**Problem:** Image build fails

```bash
docker compose up
# ERROR: Service 'backend' failed to build
```

**Solution:**
```bash
# Rebuild with verbose output
docker compose build --no-cache backend

# Check Dockerfile exists
ls src/backend/Dockerfile

# Verify build context
docker compose config
```

### Port Conflicts

**Problem:** Port already in use

```
Error: Bind for 0.0.0.0:3000 failed: port is already allocated
```

**Solution:**
```bash
# Find what's using port
lsof -i :3000

# Option 1: Stop the conflicting service
# Option 2: Change port in docker-compose.yaml
ports:
  - "3001:3000"    # Use different host port
```

### Volume Mounting Issues

**Problem:** Bind mount not working, code changes not reflected

**Solution:**
```bash
# Verify volume syntax
docker compose config

# Check path is relative to docker-compose.yaml
volumes:
  - ./src/backend:/app    # ✅ Relative from compose file

# Check file exists
ls -la src/backend

# Force recreate containers
docker compose up -d --force-recreate

# For Windows/Mac: Ensure Docker Desktop file sharing enabled
```

### Service Won't Start

**Problem:** Container exits immediately

```bash
docker compose ps
# STATUS: Exited (1)
```

**Solution:**
```bash
# Check logs
docker compose logs backend

# Run without detached mode to see errors
docker compose up backend

# Verify service definition
docker compose config backend

# Check for missing dependencies
docker compose exec backend npm list
```

### Environment Variables Not Loading

**Problem:** Undefined environment variables in container

**Solution:**
```bash
# Verify env file exists
cat env/backend.env

# Check path in compose file (relative to compose file)
env_file:
  - ./env/backend.env    # ✅ Correct

# Verify variables in container
docker compose exec backend printenv | grep MONGODB

# Rebuild if Dockerfile changed
docker compose up --build
```

### Network Issues

**Problem:** Services can't communicate

**Solution:**
```bash
# Test DNS resolution
docker compose exec backend getent hosts mongodb

# Check network
docker compose exec backend cat /etc/hosts

# Verify all services on same network
docker network inspect 13-docker-compose-goals-app_default

# Restart services
docker compose restart
```

### Dependency Issues

**Problem:** Backend starts before MongoDB ready

**Solution:**
```yaml
# Add health checks
services:
  mongodb:
    healthcheck:
      test: ["CMD", "mongosh", "--eval", "db.adminCommand('ping')"]
      interval: 10s
  
  backend:
    depends_on:
      mongodb:
        condition: service_healthy    # Wait for health check
```

## Best Practices

### 1. Project Organization

```
project/
├── docker-compose.yaml        # Root level
├── .env                       # Environment variables
├── .dockerignore              # Ignore patterns
├── src/
│   ├── backend/
│   │   ├── Dockerfile
│   │   └── ...
│   └── frontend/
│       ├── Dockerfile
│       └── ...
└── env/
    ├── backend.env
    └── frontend.env
```

### 2. Use .env Files for Secrets

```yaml
# docker-compose.yaml
services:
  backend:
    env_file:
      - ./env/common.env
      - ./env/backend.env
```

**Never commit secrets to git!**

### 3. Version Control Strategy

```bash
# .gitignore
env/*.env               # Don't commit secrets
**/node_modules/
**/logs/
**/.env

# DO commit
docker-compose.yaml     # Configuration
env/*.env.example       # Template for env files
.dockerignore
```

### 4. Clear Service Names

```yaml
# ✅ Good - descriptive
services:
  mongodb:
  api-backend:
  react-frontend:

# ❌ Bad - unclear
services:
  db:
  app1:
  app2:
```

### 5. Use Named Volumes for Data

```yaml
# ✅ Good - managed by Docker
volumes:
  mongodb-data:/data/db

# ❌ Bad - tied to host filesystem
volumes:
  ./data:/data/db
```

### 6. Health Checks for Reliability

```yaml
services:
  mongodb:
    healthcheck:
      test: ["CMD", "mongosh", "--eval", "db.adminCommand('ping')"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s

  backend:
    depends_on:
      mongodb:
        condition: service_healthy
```

### 7. Specify Image Versions

```yaml
# ✅ Good - pinned version
services:
  mongodb:
    image: mongo:7.0

# ❌ Bad - unpredictable
services:
  mongodb:
    image: mongo:latest
```

### 8. Use Multi-Stage Builds

```dockerfile
# Dockerfile
FROM node:25 AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .

FROM node:25-alpine
COPY --from=builder /app /app
CMD ["node", "app.js"]
```

### 9. Resource Limits (Production)

```yaml
services:
  backend:
    deploy:
      resources:
        limits:
          cpus: '0.50'
          memory: 512M
        reservations:
          cpus: '0.25'
          memory: 256M
```

### 10. Use Restart Policies

```yaml
services:
  backend:
    restart: unless-stopped
    # Options: no, always, on-failure, unless-stopped
```

### 11. Modern v2 Syntax

```yaml
# ✅ Modern - no version
services:
  app:
    image: nginx:alpine

# ⚠️ Legacy - still works but unnecessary
version: "3.8"
services:
  app:
    image: nginx:alpine
```

### 12. Leverage Compose v2 Features

```yaml
# Health check conditions
depends_on:
  mongodb:
    condition: service_healthy
    restart: true

# Custom names
volumes:
  data:
    name: my-app-data

networks:
  app-net:
    name: my-app-network
```

## What You Learned

In this lab, you:
- ✅ Converted multi-container docker run commands to docker-compose.yaml
- ✅ Used Docker Compose v2 modern syntax (no version field)
- ✅ Configured services with images and build contexts
- ✅ Managed volumes (named, bind mounts, anonymous) in Compose
- ✅ Used environment files for configuration
- ✅ Implemented service dependencies with depends_on
- ✅ Added health checks and dependency conditions
- ✅ Controlled multi-container lifecycle with single commands
- ✅ Leveraged automatic network creation and DNS resolution
- ✅ Applied Docker Compose v2 best practices
- ✅ Debugged common Compose configuration issues

**Key Takeaways:**

1. **Single Source of Truth:** docker-compose.yaml is the complete definition of your application

2. **Simplified Workflow:** `docker compose up` replaces multiple docker run commands

3. **Relative Paths:** Compose allows relative paths for bind mounts, making config portable

4. **Automatic Networking:** Compose creates network and handles DNS automatically

5. **Development-Focused:** Perfect for local development, testing, and CI/CD

6. **Declarative Configuration:** Describe desired state, Compose handles execution

7. **Version Control Friendly:** YAML file easily version controlled and shared

8. **Modern v2 Syntax:** No version field needed, cleaner configuration

**Next Steps:**
- Explore production deployment with Docker Swarm or Kubernetes
- Implement CI/CD pipelines using Compose
- Learn docker-compose override files for multiple environments
- Study Compose watch mode for advanced live reload
- Build complex microservices architectures with Compose