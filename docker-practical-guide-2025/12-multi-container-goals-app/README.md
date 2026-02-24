# Multi-Container Goals Application Lab

## Lab Overview

This comprehensive hands-on lab demonstrates building a complete production-like multi-container application using Docker. You'll containerize a full-stack application consisting of a React frontend, Node.js REST API backend, and MongoDB database, implementing data persistence, live code reloading, security best practices, and inter-container networking.

**What you'll do:**
- Build a complete 3-tier application architecture with Docker
- Containerize a React single-page application (SPA)
- Containerize a Node.js REST API backend
- Run MongoDB in a container with authentication
- Implement container-to-container communication
- Configure data persistence with volumes and bind mounts
- Enable live code reloading for development
- Use environment variables for configuration
- Optimize Docker images with .dockerignore

## Prerequisites

**Required Software:**
- Docker client and daemon installed and running
- Text editor or IDE
- Terminal with basic command knowledge

**Knowledge Requirements:**
- **REQUIRED:** Completion of Docker volumes and bind mounts demos
- **REQUIRED:** Completion of networking demos (Cases 1, 2, 3)
- Basic knowledge of REST APIs
- Familiarity with React helpful but not required
- Familiarity with Node.js/Express helpful but not required

**Important:**
- ✅ No local MongoDB installation required
- ✅ Application can run entirely in containers
- ✅ All code provided - no coding required

## Lab Objectives

By the end of this lab, you will be able to:

1. ✅ Architect and containerize a complete full-stack application
2. ✅ Implement secure MongoDB with authentication in containers
3. ✅ Connect frontend, backend, and database containers
4. ✅ Configure data persistence for database and logs
5. ✅ Enable live source code updates during development
6. ✅ Use environment variables for dynamic configuration
7. ✅ Optimize container builds with .dockerignore
8. ✅ Understand browser vs. container code execution
9. ✅ Troubleshoot multi-container networking issues
10. ✅ Apply Docker best practices for development environments

## Application Architecture

### High-Level Design

```
┌────────────────────────────────────────────────────────────────┐
│                        User's Browser                          │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │          React SPA (localhost:3000)                      │  │
│  │  - Renders UI in browser                                 │  │
│  │  - JavaScript runs CLIENT-SIDE                           │  │
│  │  - Manages state and user interactions                   │  │
│  └────────────────────┬─────────────────────────────────────┘  │
│                       │ HTTP Requests (JSON)                   │
└───────────────────────┼────────────────────────────────────────┘
                        │
                        ▼
┌────────────────────────────────────────────────────────────────┐
│                    Docker Host Machine                         │
│                                                                │
│  ┌──────────────── Docker Network: goals-net ───────────────┐  │
│  │                                                          │  │
│  │  ┌────────────────────┐         ┌────────────────────┐   │  │
│  │  │  Frontend          │         │  Backend           │   │  │
│  │  │  Container         │         │  Container         │   │  │
│  │  │  (goals-frontend)  │         │  (goals-backend)   │   │  │
│  │  ├────────────────────┤         ├────────────────────┤   │  │
│  │  │ - Dev Server (3000)│         │ - Node.js API (80) │   │  │
│  │  │ - Serves React SPA │◄────────┤ - Express REST API │   │  │
│  │  │ - Hot reload       │  HTTP   │ - Morgan logging   │   │  │
│  │  │ - Bind mount: src/ │         │ - Nodemon watch    │   │  │
│  │  └────────────────────┘         └──────────┬─────────┘   │  │
│  │         │                                  │             │  │
│  │         │ Published                        │ Mongoose    │  │
│  │         │ Port 3000                        │ ODM         │  │
│  │         ▼                                  ▼             │  │
│  │   localhost:3000                   ┌─────────────────┐   │  │
│  │                                    │  MongoDB        │   │  │
│  │                                    │  Container      │   │  │
│  │                                    │  (mongodb)      │   │  │
│  │                                    ├─────────────────┤   │  │
│  │                                    │ - Port: 27017   │   │  │
│  │                                    │ - Auth enabled  │   │  │
│  │                                    │ - Named volume  │   │  │
│  │                                    │ - Data persists │   │  │
│  │                                    └─────────────────┘   │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                │
│  ┌──────────────── Docker Volumes ─────────────────┐           │
│  │ - data (MongoDB data persistence)               │           │
│  │ - logs (Backend log files)                      │           │
│  │ - Bind mount: backend source (live updates)     │           │
│  │ - Bind mount: frontend source (live updates)    │           │
│  └─────────────────────────────────────────────────┘           │
└────────────────────────────────────────────────────────────────┘
```

### Component Descriptions

#### 1. **Frontend - React SPA Container**
**Technology Stack:** React 18, JavaScript, CSS
**Purpose:** User interface for managing goals

**Features:**
- Single-Page Application (SPA) with React
- Runs in browser (NOT in container)
- Development server in container serves optimized code
- Hot module replacement for live updates
- Communicates with backend via HTTP/JSON

**Key Points:**
- React code executes in **user's browser**, not in container
- Container only runs development server
- Must use `localhost` to reach backend (not container names)
- Bind mount enables instant code updates

#### 2. **Backend - Node.js REST API Container**
**Technology Stack:** Node.js, Express, Mongoose, Morgan
**Purpose:** REST API for CRUD operations on goals

**Features:**
- RESTful API with Express framework
- Mongoose ODM for MongoDB interactions
- Morgan for HTTP request logging
- CORS enabled for frontend communication
- Nodemon for automatic server restarts

**API Endpoints:**
```
GET    /goals       - Retrieve all goals
POST   /goals       - Create a new goal
DELETE /goals/:id   - Delete a specific goal
```

**Key Points:**
- Runs server-side code in container
- Connects to MongoDB using container name
- Logs written to `/app/logs` directory
- Bind mount + nodemon = live code updates

#### 3. **Database - MongoDB Container**
**Technology Stack:** MongoDB 7.0
**Purpose:** Persistent data storage for goals

**Features:**
- Official MongoDB image from Docker Hub
- Authentication with username/password
- Named volume for data persistence
- Automatic initialization with credentials

**Key Points:**
- Data stored in `/data/db` inside container
- Volume ensures data survives container removal
- Only accessible from backend container (same network)
- No port published to host (security)

### Data Flow

**Adding a Goal:**
```
1. User types goal in browser React app
2. React sends POST /goals to localhost:80
3. Request reaches backend container (published port)
4. Backend validates and creates Goal document
5. Backend saves to MongoDB via mongoose.connect('mongodb://mongodb:27017/...')
6. MongoDB stores in /data/db (persisted volume)
7. Backend responds with created goal
8. React updates UI state
```

**Fetching Goals:**
```
1. React app loads, sends GET /goals to localhost:80
2. Backend receives request
3. Backend queries MongoDB: Goal.find()
4. MongoDB returns all goals from database
5. Backend formats and returns JSON response
6. React renders goals in UI
```

### Network Communication Patterns

| From | To | Method | Purpose |
|------|----| -------|---------|
| Browser | Frontend Container | HTTP | Load React app assets |
| Browser | Backend Container | HTTP (localhost:80) | API calls (CRUD) |
| Backend Container | MongoDB Container | MongoDB Protocol (mongodb:27017) | Database operations |
| Frontend Container | External | N/A | Dev server doesn't make external calls |
| Backend Container | External | N/A | No external API calls in this app |

### Why This Architecture?

**Separation of Concerns:**
- Frontend handles presentation
- Backend handles business logic
- Database handles persistence

**Scalability:**
- Each tier can be scaled independently
- Multiple frontend containers can share one backend
- Multiple backend containers can share one database

**Security:**
- MongoDB not exposed to internet
- Backend validates all requests
- Frontend can't access database directly

**Development Efficiency:**
- Live code updates without rebuilds
- Each service can be developed independently
- Easy to test individual components

## Demo Application

### Goals Tracker Application

A course goals tracking application where users can add, view, and delete their learning goals.

**Project Structure:**
```
12-12-multi-container-goals-app/
├── README.md                              # This file
└── src/
    ├── backend/                           # Node.js REST API
    │   ├── Dockerfile                     # Backend container definition
    │   ├── app.js                         # Express application
    │   ├── package.json                   # Backend dependencies
    │   ├── models/
    │   │   └── goal.js                    # Mongoose schema for goals
    │   └── logs/
    │       └── access.log                 # Morgan HTTP request logs
    │
    └── frontend/                          # React SPA
        ├── Dockerfile                     # Frontend container definition
        ├── README.md                      # Create React App documentation
        ├── package.json                   # Frontend dependencies
        ├── package-lock.json              # Locked dependency versions
        ├── public/                        # Static assets
        │   ├── favicon.ico
        │   ├── index.html                 # HTML template
        │   ├── logo192.png
        │   ├── logo512.png
        │   ├── manifest.json              # PWA manifest
        │   └── robots.txt
        └── src/                           # React source code
            ├── index.js                   # React entry point
            ├── index.css                  # Global styles
            ├── App.js                     # Main React component with API calls
            └── components/
                ├── goals/
                │   ├── GoalInput.js       # Input form component
                │   ├── GoalInput.css
                │   ├── CourseGoals.js     # Goals list component
                │   ├── CourseGoals.css
                │   ├── GoalItem.js        # Individual goal component
                │   └── GoalItem.css
                └── UI/
                    ├── Card.js            # Card wrapper component
                    ├── Card.css
                    ├── ErrorAlert.js      # Error display component
                    ├── ErrorAlert.css
                    ├── LoadingSpinner.js  # Loading indicator
                    └── LoadingSpinner.css
```

**Key Files:**
- **Backend:**
  - `app.js` - Express server with MongoDB connection, CORS, and REST endpoints
  - `models/goal.js` - Mongoose schema defining goal structure
  - `Dockerfile` - Multi-stage build with nodemon for development
  - `logs/access.log` - HTTP request logs (persisted via volume)

- **Frontend:**
  - `App.js` - Main component with state management and API calls
  - `components/goals/` - Goal-related components (input, list, item)
  - `components/UI/` - Reusable UI components (card, error, spinner)
  - `Dockerfile` - Development server setup with hot reload

**Application Features:**
- Add new goals with text input
- Display all goals in a scrollable list
- Delete goals by clicking on them
- Data persists across container restarts
- Real-time UI updates
- Error handling and loading states

## Lab Instructions

### Step 1: Setup Project Structure

### Step 2: Copy  Backend Files

### Step 3: Copy Frontend Files

**Note:** Complete source code is provided in the attached files. We'll create Dockerfiles and configuration as we go.

### Step 4: Create Docker Network

**4.1 Create custom network for all containers:**

```bash
docker network create goals-net
```

**4.2 Verify network:**

```bash
docker network ls
```

**Expected output:**
```
NETWORK ID     NAME        DRIVER    SCOPE
abc123def456   goals-net   bridge    local
```

✅ **Network created for inter-container communication!**

### Step 5: Start MongoDB Container

**5.1 Run MongoDB with authentication and volume:**

```bash
docker run -d \
  --name mongodb \
  --rm \
  --network goals-net \
  -v data:/data/db \
  -e MONGO_INITDB_ROOT_USERNAME=rselvantech \
  -e MONGO_INITDB_ROOT_PASSWORD=passWD \
  mongo
```

**Command breakdown:**
- `-d` - Detached mode
- `--name mongodb` - Container name (becomes DNS hostname)
- `--rm` - Auto-remove when stopped
- `--network goals-net` - Connect to custom network
- `-v data:/data/db` - Named volume for data persistence
- `-e MONGO_INITDB_ROOT_USERNAME=rselvantech` - Set MongoDB username
- `-e MONGO_INITDB_ROOT_PASSWORD=passWD` - Set MongoDB password
- `mongo` - Official MongoDB image

**Note:** Port NOT published - only accessible from same network

**5.2 Verify MongoDB is running:**

```bash
docker ps
```

**Expected output:**
```
CONTAINER ID   IMAGE   COMMAND                  CREATED         STATUS         PORTS       NAMES
abc123def456   mongo   "docker-entrypoint.s…"   10 seconds ago  Up 9 seconds   27017/tcp   mongodb
```

**5.3 Check MongoDB logs:**

```bash
docker logs mongodb
```

**Expected:** MongoDB waiting for connections on port 27017

✅ **MongoDB running with authentication enabled!**

### Step 6: Dockerize Backend Application

**6.1 Create `src/backend/Dockerfile`:**

```dockerfile
FROM node:25

WORKDIR /app

COPY package.json .

RUN npm install

COPY . .

# Environment variables with defaults
ENV MONGODB_USERNAME=root
ENV MONGODB_PASSWORD=secret

EXPOSE 80

CMD ["npm", "start"]
```

**What this does:**
- Uses Node.js 25 as base image
- Sets working directory to `/app`
- Copies and installs dependencies first (layer caching)
- Copies source code
- Sets default environment variables
- Exposes port 80
- Starts with nodemon (from package.json start script)

**6.2 Create `src/backend/.dockerignore`:**

```
node_modules
Dockerfile
.git
```

**6.3 Build backend image:**

```bash
cd 12-multi-container-goals-app/src/backend
docker build -t goals-node .
cd ..
```

**Expected output:**
```
[+] Building 45.2s (11/11) FINISHED
 => [internal] load build definition
 => [1/6] FROM node:14
 => [2/6] WORKDIR /app
 => [3/6] COPY package.json .
 => [4/6] RUN npm install
 => [5/6] COPY . .
 => exporting to image
 => => naming to docker.io/library/goals-node
```

**6.4 Verify image:**

```bash
docker images | grep goals-node
```

✅ **Backend image built successfully!**

### Step 7: Run Backend Container

**7.1 Run backend with volumes and environment variables:**

```bash
cd 12-multi-container-goals-app/src

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
```

**Command breakdown:**
- `--network goals-net` - Same network as MongoDB
- `-p 80:80` - Publish port for frontend access
- `-v logs:/app/logs` - Named volume for log persistence
- `-v $(pwd)/backend:/app` - Bind mount for live code updates
- `-v /app/node_modules` - Anonymous volume to protect node_modules
- `-e MONGODB_USERNAME=rselvantech` - Override default username
- `-e MONGODB_PASSWORD=passWD` - Password matches MongoDB

**7.2 Verify backend is running:**

```bash
docker ps
```

**Expected:** Both `mongodb` and `goals-backend` running

**7.3 Check backend logs:**

```bash
docker logs goals-backend
```

**Expected output:**
```
[nodemon] 2.0.4
[nodemon] to restart at any time, enter `rs`
[nodemon] watching path(s): *.*
[nodemon] watching extensions: js,mjs,json
[nodemon] starting `node app.js`
CONNECTED TO MONGODB!!
```

✅ **Backend connected to MongoDB successfully!**

### Step 8: Dockerize Frontend Application

**8.1 Create `src/frontend/Dockerfile`:**

```dockerfile
FROM node:25

WORKDIR /app

COPY package.json .

RUN npm install

COPY . .

EXPOSE 3000

CMD ["npm", "start"]
```

**8.2 Create `src/frontend/.dockerignore`:**

```
node_modules
Dockerfile
.git
```

**8.3 Build frontend image:**

```bash
cd 12-multi-container-goals-app/src/frontend
docker build -t goals-react .
cd ..
```

**Note:** This takes a while as React has many dependencies

**Expected output:**
```
[+] Building 120.5s (11/11) FINISHED
 => [internal] load build definition
 => [1/6] FROM node:14
 => [2/6] WORKDIR /app
 => [3/6] COPY package.json .
 => [4/6] RUN npm install (this takes ~2 minutes)
 => [5/6] COPY . .
 => exporting to image
 => => naming to docker.io/library/goals-react
```

✅ **Frontend image built successfully!**

### Step 9: Run Frontend Container

**9.1 Run frontend with interactive mode and bind mount:**

```bash
docker run -d \
  --name goals-frontend \
  --rm \
  -p 3000:3000 \
  -v $(pwd)/frontend/src:/app/src \
  -it \
  goals-react
```

**Command breakdown:**
- `-p 3000:3000` - Publish port for browser access
- `-v $(pwd)/frontend/src:/app/src` - Bind mount for live updates
- `-it` - Interactive mode (required for React dev server)
- **NO --network** - Not needed, React code runs in browser

**Why no network?**
- React code executes in **browser**, not container
- Container only runs development server
- Frontend accesses backend via `localhost:80` (published port)

**9.2 Verify all containers running:**

```bash
docker ps
```

**Expected output:**
```
CONTAINER ID   IMAGE         COMMAND                  STATUS         PORTS                    NAMES
abc123def456   goals-react   "docker-entrypoint.s…"   Up 10 seconds  0.0.0.0:3000->3000/tcp   goals-frontend
def456abc789   goals-node    "docker-entrypoint.s…"   Up 2 minutes   0.0.0.0:80->80/tcp       goals-backend
789abc123def   mongo         "docker-entrypoint.s…"   Up 5 minutes   27017/tcp                mongodb
```

✅ **All three containers running!**

### Step 10: Test the Application

**10.1 Open application in browser:**

```
http://localhost:3000
```

**Expected:** React application loads with empty goals list

**10.2 Add a goal:**

Type "Learn Docker" and click "Add Goal"

**Expected:** Goal appears in list

**10.3 Verify data in backend logs:**

```bash
docker logs goals-backend
```

**Expected output:**
```
TRYING TO STORE GOAL
STORED NEW GOAL
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

Add "Master Multi-Container Apps"

**11.2 Stop and remove MongoDB container:**

```bash
docker stop mongodb
```

**11.3 Start new MongoDB container with same volume:**

```bash
docker run -d \
  --name mongodb \
  --rm \
  --network goals-net \
  -v data:/data/db \
  -e MONGO_INITDB_ROOT_USERNAME=rselvantech \
  -e MONGO_INITDB_ROOT_PASSWORD=passWD \
  mongo
```

**11.4 Reload browser:**

**Expected:** Goal "Master Multi-Container Apps" still appears!

✅ **Data persisted across container recreation!**

### Step 12: Test Live Code Reloading

**12.1 Backend live reload:**

Edit `src/backend/app.js`, line where it says `CONNECTED TO MONGODB!!`:

```javascript
console.log('CONNECTED TO MONGODB!! - Live reload works!');
```

**12.2 Check backend logs:**

```bash
docker logs goals-backend
```

**Expected output:**
```
[nodemon] restarting due to changes...
[nodemon] starting `node app.js`
CONNECTED TO MONGODB!! - Live reload works!
```

✅ **Backend automatically restarted on code change!**

**12.3 Frontend live reload:**

Edit `src/frontend/src/App.js`, add a heading:

```javascript
return (
  <div>
    <h1>My Goals Tracker</h1>
    {error && <ErrorAlert errorText={error} />}
    <GoalInput onAddGoal={addGoalHandler} />
    {!isLoading && (
      <CourseGoals goals={loadedGoals} onDeleteGoal={deleteGoalHandler} />
    )}
  </div>
);
```

**Expected:** Browser automatically reloads, heading appears

✅ **Frontend hot module replacement working!**

### Step 13: Inspect Network Communication

**13.1 View network details:**

```bash
docker network inspect goals-net
```

**Expected output (containers section):**
```json
"Containers": {
    "abc123...": {
        "Name": "mongodb",
        "IPv4Address": "172.18.0.2/16"
    },
    "def456...": {
        "Name": "goals-backend",
        "IPv4Address": "172.18.0.3/16"
    }
}
```

**Note:** Frontend NOT in network (doesn't need to be)

**13.2 Test DNS resolution from backend:**

```bash
docker exec goals-backend getent hosts mongodb
```

**Expected output:**
```
172.18.0.2      mongodb
```

✅ **Container DNS resolution working!**

### Step 14: Cleanup

**14.1 Stop all containers:**

```bash
docker stop goals-frontend goals-backend mongodb
```

**Note:** Containers auto-remove (--rm flag)

**14.2 Remove network:**

```bash
docker network rm goals-net
```

**14.3 Remove volumes (optional - deletes data):**

```bash
docker volume rm data logs
```

**14.4 Remove images (optional):**

```bash
docker rmi goals-react goals-node mongo
```

## Understanding Key Concepts

### Why Frontend Can't Use Container Names

**The Problem:**

In `frontend/src/App.js`:
```javascript
// ❌ This DOES NOT work:
const response = await fetch('http://goals-backend/goals');
```

**Why it fails:**
1. React code runs in **browser**, not in container
2. Browser has no idea what `goals-backend` means
3. Only Docker containers can resolve container names
4. Frontend container only runs dev server, not React code

**The Solution:**

```javascript
// ✅ This WORKS:
const response = await fetch('http://localhost/goals');
```

**Why it works:**
1. Browser understands `localhost`
2. Backend publishes port 80 to host
3. Browser → localhost:80 → Backend container

### Container vs Browser Execution

| Code Location | Runs Where | Can Use Container Names? | Why? |
|---------------|------------|-------------------------|------|
| `backend/app.js` | Backend container | ✅ Yes | Docker environment |
| `frontend/src/App.js` | User's browser | ❌ No | Not in Docker |
| Frontend dev server | Frontend container | ✅ Yes (but doesn't need to) | Docker environment |

### Volume Precedence Rules

**In `backend` Docker run command:**

```bash
-v logs:/app/logs                # Named volume for logs
-v $(pwd)/backend:/app           # Bind mount for source code
-v /app/node_modules             # Anonymous volume for dependencies
```

**Precedence (longer paths win):**
1. `/app/node_modules` - Most specific, survives bind mount
2. `/app/logs` - More specific than `/app`
3. `/app` - Least specific, overridden by above

**Result:**
- `/app` gets host machine code (bind mount)
- `/app/node_modules` stays from container (anonymous volume)
- `/app/logs` persists in named volume (named volume)

### Environment Variables Flow

**Dockerfile:**
```dockerfile
ENV MONGODB_USERNAME=root
ENV MONGODB_PASSWORD=secret
```

**Docker run (overrides):**
```bash
-e MONGODB_USERNAME=rselvantech
-e MONGODB_PASSWORD=passWD
```

**Application code:**
```javascript
const username = process.env.MONGODB_USERNAME; // "rselvantech"
const password = process.env.MONGODB_PASSWORD; // "passWD"
```

**Connection string:**
```javascript
`mongodb://${username}:${password}@mongodb:27017/course-goals?authSource=admin`
// Results in: mongodb://max:secret@mongodb:27017/course-goals?authSource=admin
```

## Complete Docker Commands Reference

### Network Management

| Command | Description |
|---------|-------------|
| `docker network create goals-net` | Create custom network |
| `docker network ls` | List networks |
| `docker network inspect goals-net` | View network details |
| `docker network rm goals-net` | Remove network |

### Container Management

| Command | Description |
|---------|-------------|
| `docker ps` | List running containers |
| `docker ps -a` | List all containers |
| `docker logs <container>` | View container logs |
| `docker logs -f <container>` | Follow logs in real-time |
| `docker exec <c> <command>` | Execute command in container |
| `docker stop <container>` | Stop container |
| `docker start <container>` | Start stopped container |

### Volume Management

| Command | Description |
|---------|-------------|
| `docker volume ls` | List volumes |
| `docker volume inspect <volume>` | View volume details |
| `docker volume rm <volume>` | Remove volume |
| `docker volume prune` | Remove unused volumes |

### Image Management

| Command | Description |
|---------|-------------|
| `docker images` | List images |
| `docker rmi <image>` | Remove image |
| `docker build -t <name> .` | Build image |
| `docker image prune` | Remove unused images |

## Troubleshooting

### Frontend can't connect to backend

**Symptoms:**
- "Connection refused" error in browser console
- Goals don't load

**Diagnosis:**
```bash
# Check backend is running and port is published
docker ps | grep goals-backend
```

**Solutions:**
1. Ensure backend port 80 is published: `-p 80:80`
2. Check backend logs: `docker logs goals-backend`
3. Verify `localhost` used in frontend code (not container name)

### Backend can't connect to MongoDB

**Symptoms:**
- Backend logs show "FAILED TO CONNECT TO MONGODB"
- `MongoNetworkError` or authentication errors

**Diagnosis:**
```bash
# Check MongoDB is running
docker ps | grep mongodb

# Check backend logs
docker logs goals-backend
```

**Solutions:**

1. **Network issue:**
```bash
# Ensure both on same network
docker network inspect goals-net
```

2. **Authentication issue:**
```bash
# Verify username/password match
# MongoDB: -e MONGO_INITDB_ROOT_USERNAME=rselvantech
# Backend: -e MONGODB_USERNAME=passWD
```

3. **Missing authSource:**
```javascript
// Connection string must include ?authSource=admin
mongodb://rselvantech:passWD@mongodb:27017/course-goals?authSource=admin
```

### Data not persisting

**Symptoms:**
- Goals disappear after container restart
- Logs lost after container removal

**Diagnosis:**
```bash
# Check volumes exist
docker volume ls

# Check volume is mounted
docker inspect goals-backend -f '{{.Mounts}}'
```

**Solutions:**
1. Ensure named volumes specified: `-v data:/data/db`
2. Don't use `--rm` if testing persistence
3. Use same volume name when restarting

### Live code updates not working

**Symptoms:**
- Code changes don't reflect in running app
- Need to rebuild image to see changes

**Diagnosis:**
```bash
# Check bind mount exists
docker inspect goals-backend -f '{{.Mounts}}'
```

**Solutions:**

1. **Backend:**
- Ensure bind mount: `-v $(pwd)/backend:/app`
- Check nodemon is running: `docker logs goals-backend`
- Verify `CMD ["npm", "start"]` uses nodemon

2. **Frontend:**
- Ensure bind mount: `-v $(pwd)/frontend/src:/app/src`
- Run with `-it` flag
- **Windows WSL2:** Use Linux filesystem, not Windows

### React dev server stops immediately

**Symptoms:**
- Frontend container exits right after starting
- `docker ps` shows container not running

**Solution:**
```bash
# Add -it flag for interactive mode
docker run -it -p 3000:3000 goals-react
```

### Port already in use

**Symptoms:**
```
Error: bind: address already in use
```

**Diagnosis:**
```bash
# Check what's using the port
lsof -i :80      # Mac/Linux
netstat -ano | findstr :80  # Windows
```

**Solutions:**
1. Stop conflicting service
2. Use different host port: `-p 8080:80`

### "Cannot find module" errors

**Symptoms:**
```
Error: Cannot find module 'express'
```

**Solutions:**
1. Rebuild image: `docker build -t goals-node .`
2. Ensure anonymous volume: `-v /app/node_modules`
3. Check .dockerignore doesn't exclude package.json

## Production Considerations

**⚠️ This is a DEVELOPMENT setup. For production:**

### What to Change:

1. **Remove live reloading:**
   - No nodemon in backend
   - No dev server in frontend
   - Use `CMD ["node", "app.js"]` for backend
   - Build optimized frontend: `npm run build`

2. **Remove bind mounts:**
   - Code should be in image, not mounted
   - Only use volumes for data persistence

3. **Security:**
   - Use strong passwords (not "secret")
   - Use environment files or secrets management
   - Don't expose database port
   - Use Docker secrets for sensitive data

4. **Optimize images:**
   - Use multi-stage builds
   - Minimize layers
   - Use specific base image versions (not `latest`)
   - Remove dev dependencies

5. **Networking:**
   - Use production-grade reverse proxy (nginx)
   - Implement load balancing
   - Use container orchestration (Kubernetes, Docker Swarm)

6. **Logging:**
   - Use centralized logging solution
   - Don't rely on container logs

7. **Deployment:**
   - Use docker-compose or Kubernetes manifests
   - Implement CI/CD pipeline
   - Use container registry (Docker Hub, ECR, GCR)

## What You Learned

In this lab, you:
- ✅ Built a complete 3-tier containerized application
- ✅ Implemented MongoDB with authentication in containers
- ✅ Connected frontend, backend, and database containers
- ✅ Configured data persistence with named volumes
- ✅ Enabled live code updates with bind mounts
- ✅ Used environment variables for dynamic configuration
- ✅ Understood browser vs. container code execution
- ✅ Implemented nodemon for backend auto-restart
- ✅ Optimized builds with .dockerignore
- ✅ Troubleshot multi-container networking issues
- ✅ Applied Docker best practices for development

**Key Takeaways:**

1. **Separation of Concerns:** Each service in its own container provides isolation, scalability, and maintainability

2. **Network Architecture:** Custom Docker networks enable container-to-container communication with DNS resolution

3. **Data Persistence:** Named volumes ensure data survives container lifecycle

4. **Development Efficiency:** Bind mounts + watchers (nodemon) enable live code updates without rebuilds

5. **Browser vs Container:** React code runs in browser, must use localhost; backend code runs in container, can use container names

6. **Security:** MongoDB authentication adds layer of protection; environment variables allow flexible configuration

7. **Volume Precedence:** Longer internal paths override shorter paths; use anonymous volumes to protect specific folders

**Next Steps:**
- Learn docker-compose to simplify multi-container management
- Explore production deployment strategies
- Implement container orchestration with Kubernetes
- Study CI/CD pipelines for containerized applications
- Build more complex microservices architectures