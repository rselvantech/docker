# Docker Container to Host Services Communication Lab

## Lab Overview

This hands-on lab builds upon [09-network-case1-external-apis](../09-network-case1-external-apis/) to solve the Container → Host communication challenge. You'll learn how Docker containers can access services running on the host machine (like MongoDB), understand the special DNS name `host.docker.internal`, and explore different networking approaches for connecting containerized applications to host-based databases.

**What you'll do:**
- Understand why `localhost` doesn't work from containers
- Learn about Docker's special DNS name `host.docker.internal`
- Connect a containerized Node.js app to host MongoDB
- Explore alternative solutions for different platforms
- Test database operations from containerized applications
- Implement production-ready connection strategies

## Prerequisites

**Required Software:**
- Docker client and daemon installed and running
- MongoDB installed and running on host machine (see installation guide below)
- Text editor or IDE
- Terminal with curl or HTTP client (Postman, Insomnia, etc.)

**Knowledge Requirements:**
- **REQUIRED:** Completion of [09-network-case1-external-apis](../09-network-case1-external-apis/)
- Understanding of Container → WWW communication
- Basic MongoDB knowledge
- Familiarity with REST APIs and Mongoose ODM

**MongoDB Setup:**
- **📖 See:** [MongoDB Installation Guide for Ubuntu](./mongodb-installation-ubuntu.md)
- MongoDB must be running on host machine before starting this lab
- **Linux Users:** MongoDB must be configured to listen on Docker bridge IP (covered in Step 6)
- Database: `swfavorites` (will be created automatically by Mongoose)
- Port: `27017` (MongoDB default)

## Lab Objectives

By the end of this lab, you will be able to:

1. ✅ Understand the Container → Host networking challenge
2. ✅ Use `host.docker.internal` DNS name for host access
3. ✅ Configure MongoDB connection strings for Docker environments
4. ✅ Handle platform-specific networking differences (Mac/Windows/Linux)
5. ✅ Test full CRUD operations from containerized apps to host databases
6. ✅ Troubleshoot connection issues between containers and host services
7. ✅ Implement environment variables for flexible configuration

## Demo Application

### Star Wars Favorites API with Host MongoDB

The same Node.js/Express application from Case 1, now with full MongoDB integration.

**Application Structure:**
```
10-network-case2-host-services/
├── README.md                       # This file
├── mongodb-installation-ubuntu.md  # MongoDB setup guide
├── understand-docker-bridge-and-172.17.0.1.md  # Understand why we need to add 172.17.0.1 in mongodb config
└── src/
    ├── app.js                      # UPDATED: MongoDB connection uncommented
    ├── package.json                # Same dependencies
    ├── Dockerfile                  # Same image definition
    └── models/
        └── favorite.js             # MongoDB schema
```

**What's different from Case 1:**
- MongoDB connection code **uncommented** and **updated**
- Uses `host.docker.internal` instead of `localhost`
- Full database functionality enabled
- All endpoints operational

**Endpoints:**
- `GET /movies` - Fetch movies from external API (Container → WWW)
- `GET /people` - Fetch characters from external API (Container → WWW)
- `GET /favorites` - List saved favorites (Container → Host MongoDB) ✅ NEW
- `POST /favorites` - Save new favorite (Container → Host MongoDB) ✅ NEW

## Understanding Container → Host Networking

### The Localhost Problem (Recap)

**From Case 1, we learned:**

```javascript
// In container, this fails:
mongoose.connect('mongodb://localhost:27017/swfavorites')
// ❌ Container looks for MongoDB inside itself, not on host
```

**Why it fails:**
- `localhost` inside container = container's own loopback (127.0.0.1)
- MongoDB is running on host machine, not in container
- Container's network namespace is isolated from host

### The Solution: host.docker.internal

Docker provides a special DNS name that resolves to the host machine:

| Platform | Special DNS Name | How It Works |
|----------|------------------|--------------|
| **Docker Desktop (Mac)** | `host.docker.internal` | Built-in, works automatically |
| **Docker Desktop (Windows)** | `host.docker.internal` | Built-in, works automatically |
| **Linux** | `host.docker.internal` | Requires `--add-host` flag |

**Updated connection string:**
```javascript
// This works from container to reach host MongoDB:
mongoose.connect('mongodb://host.docker.internal:27017/swfavorites')
// ✅ Container → host.docker.internal → Host machine → MongoDB
```

### How host.docker.internal Works

**Architecture:**

```
┌─────────────────────────────────────────────────────────┐
│                    Host Machine                         │
│                                                         │
│  MongoDB listening on 127.0.0.1:27017                   │
│  (or 0.0.0.0:27017 if configured)                       │
│                                                         │
│  ┌────────────────────────────────────────────┐        │
│  │         Docker Container                   │        │
│  │                                            │        │
│  │  App connects to:                          │        │
│  │  host.docker.internal:27017                │        │
│  │         ↓                                  │        │
│  │  Docker resolves to:                       │        │
│  │  Host machine IP (e.g., 192.168.65.2)      │        │
│  │         ↓                                  │        │
│  │  ✅ Connection succeeds!                   │        │
│  └────────────────────────────────────────────┘        │
└─────────────────────────────────────────────────────────┘
```

### Alternative Solutions

If `host.docker.internal` doesn't work:

**Option 1: Use Host IP Address**
```javascript
// Find host IP: hostname -I | awk '{print $1}'
mongoose.connect('mongodb://192.168.1.100:27017/swfavorites')
```
**Downside:** IP can change (DHCP), not portable

**Option 2: Configure MongoDB to Listen on All Interfaces**
```yaml
# /etc/mongod.conf
net:
  bindIp: 0.0.0.0  # Instead of 127.0.0.1
```
**Downside:** Security risk without authentication

**Option 3: Use Docker Host Network Mode**
```bash
docker run --network host myapp
```
**Downside:** Container shares host's network stack, loses isolation

**Option 4: Run MongoDB in Container (Case 3)**
- Better isolation
- Easier to replicate environments
- We'll cover this in next demo

## Lab Instructions

### Step 1: Verify MongoDB is Running on Host

**Before starting, ensure MongoDB is installed and running.**

**1.1 Check MongoDB status:**

```bash
sudo systemctl status mongod
```

**Expected output:**
```
● mongod.service - MongoDB Database Server
     Active: active (running) since Thu 2026-02-05 10:30:15 UTC; 2h 15min ago
```

**Look for:** `Active: active (running)`

**If MongoDB is not running:**
```bash
sudo systemctl start mongod
```

**If MongoDB is not installed:**
- 📖 Follow the complete setup guide: [MongoDB Installation for Ubuntu](./mongodb-installation-ubuntu.md)

**1.2 Verify MongoDB is listening:**

```bash
sudo netstat -tuln | grep 27017
(OR)
sudo ss -tuln | grep 27017
```

**Expected output:**
```
tcp        0      0 127.0.0.1:27017         0.0.0.0:*               LISTEN
```

**1.3 Test MongoDB connection locally:**

```bash
mongosh
```

**If successful:**
```
Current Mongosh Log ID: 65c1234567890abcdef12345
Connecting to:          mongodb://127.0.0.1:27017/
...
test>
```

**Type `exit` to quit.**

✅ **MongoDB is ready!**

### Step 2: Setup Project Files

**2.1 Create project structure:**

```bash
mkdir -p 10-network-case2-host-services/src/models
cd 10-network-case2-host-services/src
```

**2.2 Copy files from Case 1:**

```bash
# Copy all files from previous demo
cp -r ../../09-network-case1-external-apis/src/* .
```

**Or create files manually (package.json, Dockerfile, models/favorite.js - same as Case 1)**

Refer to [09-network-case1-external-apis](../09-network-case1-external-apis/README.md) for complete file contents.

### Step 3: Update Application Code for Host Connection

**3.1 Open `app.js` in your editor**

**3.2 Locate the MongoDB connection section (lines 61-70):**

**From Case 1 (commented out):**
```javascript
// mongoose.connect(
//   'mongodb://localhost:27017/swfavorites',
//   { useNewUrlParser: true },
//   (err) => {
//     if (err) {
//       console.log(err);
//     } else {
//       app.listen(3000);
//     }
//   }
// );

app.listen(3000);
```

**Update to:**
```javascript
mongoose.connect(
  'mongodb://host.docker.internal:27017/swfavorites',
  { useNewUrlParser: true },
  (err) => {
    if (err) {
      console.log(err);
    } else {
      app.listen(3000);
    }
  }
);

// Remove the standalone app.listen(3000) outside callback
```

**What changed:**
- ✅ Uncommented MongoDB connection code
- ✅ Changed `localhost` → `host.docker.internal`
- ✅ Server starts only after successful DB connection
- ✅ Removed standalone `app.listen(3000)` 

**3.3 Save the file**

### Step 4: Build the Docker Image

**4.1 Build with new connection string:**

```bash
docker build -t favorite-node:host-network .
```

**Expected output:**
```
[+] Building 35.2s (10/10) FINISHED
 => [internal] load build definition from Dockerfile
 => => transferring dockerfile: 138B
 => [1/5] FROM node
 => [2/5] WORKDIR /app
 => [3/5] COPY package.json .
 => [4/5] RUN npm install
 => [5/5] COPY . .
 => exporting to image
 => => naming to docker.io/library/favorite-node:host-network
```

**4.2 Verify image:**

```bash
docker images | grep favorite-node
```

**Output:**
```
favorite-node   host-network   abc123def456   30 seconds ago   1.1GB
```

✅ **Image built with updated connection string!**

### Step 5: Run Container (`First Attempt - Mac/Windows`)

**If you're on Mac or Windows with Docker Desktop:**

**5.1 Run the container:**

```bash
docker run --name favorites -d --rm -p 3000:3000 favorite-node:host-network
```

**5.2 Check container status:**

```bash
docker ps
```

**Expected output:**
```
CONTAINER ID   IMAGE                        COMMAND           CREATED         STATUS         PORTS                    NAMES
abc123def456   favorite-node:host-network   "node app.js"     5 seconds ago   Up 4 seconds   0.0.0.0:3000->3000/tcp   favorites
```

✅ **Container is running!** Status shows "Up".

**5.3 Check logs for successful connection:**

```bash
docker logs favorites
```

**Expected output:**
```
(No output means successful connection and server started)
```

**If you see errors, check MongoDB is running on host.**

**Jump to Step 7 to test the application.**

### Step 6: Run Container (`Linux Users`)

**Linux doesn't have `host.docker.internal` by default. We need to configure both Docker AND MongoDB.**

#### Part A: Configure MongoDB to Listen on Docker Bridge

**6.1 Find Docker's gateway IP:**

```bash
docker network inspect bridge | grep Gateway
```

**Expected output:**
```json
"Gateway": "172.17.0.1"
```

**Note:** This is usually `172.17.0.1` but verify it on your system.

**6.2 Edit MongoDB configuration:**

```bash
sudo nano /etc/mongod.conf
```

**6.3 Find the `net:` section and update `bindIp`:**

**Before:**
```yaml
net:
  port: 27017
  bindIp: 127.0.0.1
```

**After:**
```yaml
net:
  port: 27017
  bindIp: 127.0.0.1,172.17.0.1
```

**What changed:**
- Added `172.17.0.1` (Docker gateway IP) to the binding list
- MongoDB now listens on both localhost and Docker bridge
- Comma-separated list allows multiple IPs

**6.4 Save and exit:**
- Press `Ctrl+X`
- Press `Y` to confirm
- Press `Enter` to save

**6.5 Restart MongoDB:**

```bash
sudo systemctl restart mongod
```

**6.6 Verify MongoDB is listening on both IPs:**

```bash
sudo netstat -tuln | grep 27017
(OR)
sudo ss -tuln | grep 27017
```

**Expected output:**
```
tcp        0      0 127.0.0.1:27017         0.0.0.0:*               LISTEN
tcp        0      0 172.17.0.1:27017        0.0.0.0:*               LISTEN
```

✅ **MongoDB now accepts connections from Docker containers!**

#### Part B: Run Container with --add-host Flag

**6.7 Run with `--add-host` flag:**

```bash
docker run --name favorites -d --rm \
  --add-host=host.docker.internal:host-gateway \
  -p 3000:3000 \
  favorite-node:host-network
```

**Command breakdown:**
- `--add-host=host.docker.internal:host-gateway` - Creates DNS entry
- `host-gateway` is a special value that resolves to `172.17.0.1` (gateway IP)
- Enables `host.docker.internal` just like Mac/Windows

**6.8 Verify container is running:**

```bash
docker ps
```

**Expected output:**
```
CONTAINER ID   IMAGE                        COMMAND           CREATED         STATUS         PORTS                    NAMES
abc123def456   favorite-node:host-network   "node app.js"     5 seconds ago   Up 4 seconds   0.0.0.0:3000->3000/tcp   favorites
```

**6.9 Check logs for successful connection:**

```bash
docker logs favorites
```

**Expected output:**
```
(node:1) [MONGODB DRIVER] Warning: Current Server Discovery and Monitoring engine is deprecated...
```

**Note:** The deprecation warning is harmless. The important thing is no "ECONNREFUSED" error.

**6.10 Check the DNS entry was created:**

```bash
docker exec favorites cat /etc/hosts
```

**Expected output (contains):**
```
127.0.0.1       localhost
172.17.0.1      host.docker.internal
172.17.0.2      abc123def456
```

✅ **Both MongoDB and Docker are now configured correctly!**

**Why both steps are needed on Linux:**
1. **MongoDB config:** Makes MongoDB accept connections from Docker bridge (172.17.0.1)
2. **--add-host flag:** Makes `host.docker.internal` DNS name available in container

**Jump to Step 7 to test the application.**

### Step 7: Test Container → Host MongoDB Connection

**7.1 Test GET /favorites (read from database):**

```bash
curl http://localhost:3000/favorites
```

**Expected output (initially empty):**
```json
{
  "favorites": []
}
```

✅ **Success! Container connected to host MongoDB!**

**What just happened:**
1. Your curl → Container on port 3000
2. Container → Express route `/favorites`
3. Mongoose queries `host.docker.internal:27017`
4. Docker resolves to host machine IP
5. MongoDB on host responds
6. Container returns data to you

**7.2 Test POST /favorites (write to database):**

```bash
curl -X POST http://localhost:3000/favorites \
  -H "Content-Type: application/json" \
  -d '{
    "type": "movie",
    "name": "The Empire Strikes Back",
    "url": "https://swapi.dev/api/films/2/"
  }'
```

**Expected output:**
```json
{
  "message": "Favorite saved!",
  "favorite": {
    "type": "movie",
    "name": "The Empire Strikes Back",
    "url": "https://swapi.dev/api/films/2/",
    "_id": "65c1234567890abcdef12345"
  }
}
```

✅ **Data saved to host MongoDB from container!**

**7.3 Verify data was saved - GET again:**

```bash
curl http://localhost:3000/favorites
```

**Expected output:**
```json
{
  "favorites": [
    {
      "_id": "65c1234567890abcdef12345",
      "type": "movie",
      "name": "The Empire Strikes Back",
      "url": "https://swapi.dev/api/films/2/",
      "__v": 0
    }
  ]
}
```

✅ **Data persisted in host MongoDB!**

**7.4 Add more favorites:**

```bash
# Add a character
curl -X POST http://localhost:3000/favorites \
  -H "Content-Type: application/json" \
  -d '{
    "type": "character",
    "name": "Luke Skywalker",
    "url": "https://swapi.dev/api/people/1/"
  }'

# Add another movie
curl -X POST http://localhost:3000/favorites \
  -H "Content-Type: application/json" \
  -d '{
    "type": "movie",
    "name": "Return of the Jedi",
    "url": "https://swapi.dev/api/films/3/"
  }'
```

**7.5 Retrieve all favorites:**

```bash
curl http://localhost:3000/favorites
```

**Expected output:**
```json
{
  "favorites": [
    {
      "_id": "65c1234567890abcdef12345",
      "type": "movie",
      "name": "The Empire Strikes Back",
      "url": "https://swapi.dev/api/films/2/",
      "__v": 0
    },
    {
      "_id": "65c1234567890abcdef12346",
      "type": "character",
      "name": "Luke Skywalker",
      "url": "https://swapi.dev/api/people/1/",
      "__v": 0
    },
    {
      "_id": "65c1234567890abcdef12347",
      "type": "movie",
      "name": "Return of the Jedi",
      "url": "https://swapi.dev/api/films/3/",
      "__v": 0
    }
  ]
}
```

✅ **Full CRUD operations working!**

### Step 8: Verify Data in Host MongoDB

**8.1 Connect to MongoDB on host:**

```bash
mongosh
```

**8.2 Switch to swfavorites database:**

```javascript
use swfavorites
```

**8.3 Query the favorites collection:**

```javascript
db.favorites.find().pretty()
```

**Expected output:**
```javascript
[
  {
    _id: ObjectId('65c1234567890abcdef12345'),
    type: 'movie',
    name: 'The Empire Strikes Back',
    url: 'https://swapi.dev/api/films/2/',
    __v: 0
  },
  {
    _id: ObjectId('65c1234567890abcdef12346'),
    type: 'character',
    name: 'Luke Skywalker',
    url: 'https://swapi.dev/api/people/1/',
    __v: 0
  },
  {
    _id: ObjectId('65c1234567890abcdef12347'),
    type: 'movie',
    name: 'Return of the Jedi',
    url: 'https://swapi.dev/api/films/3/',
    __v: 0
  }
]
```

✅ **Data is in host MongoDB! Container successfully wrote to host database!**

**8.4 Exit MongoDB shell:**

```javascript
exit
```

### Step 9: Test Container Restart with Data Persistence

**9.1 Stop and remove container:**

```bash
docker stop favorites
```

**Note:** Container auto-removes due to `--rm` flag.

**9.2 Start a new container:**

**Mac/Windows:**
```bash
docker run --name favorites -d --rm -p 3000:3000 favorite-node:host-network
```

**Linux:**
```bash
docker run --name favorites -d --rm \
  --add-host=host.docker.internal:host-gateway \
  -p 3000:3000 \
  favorite-node:host-network
```

**9.3 Check favorites in new container:**

```bash
curl http://localhost:3000/favorites
```

**Expected output:**
```json
{
  "favorites": [
    {
      "_id": "65c1234567890abcdef12345",
      "type": "movie",
      "name": "The Empire Strikes Back",
      ...
    },
    ...
  ]
}
```

✅ **Data persisted!** New container sees same data because it connects to host MongoDB.

**Key insight:**
- Data lives in host MongoDB, not in container
- Containers are ephemeral, database is persistent
- Multiple containers can share same host database

### Step 10: Test All Endpoints (Full Integration)

**10.1 External API calls (Container → WWW):**

```bash
# Get movies
curl http://localhost:3000/movies

# Get people
curl http://localhost:3000/people
```

Both should work (from Case 1).

**10.2 Database operations (Container → Host):**

```bash
# Get favorites
curl http://localhost:3000/favorites

# Add favorite
curl -X POST http://localhost:3000/favorites \
  -H "Content-Type: application/json" \
  -d '{"type":"movie","name":"A New Hope","url":"https://swapi.dev/api/films/1/"}'
```

Both should work (new in Case 2).

✅ **All communication patterns working:**
- ✅ Container → WWW (external APIs)
- ✅ Container → Host (MongoDB)

### Step 11: Environment Variables for Flexible Configuration

**For production deployments, hardcoding connection strings is bad practice.**

**11.1 Update `app.js` to use environment variables:**

**Before:**
```javascript
mongoose.connect(
  'mongodb://host.docker.internal:27017/swfavorites',
  { useNewUrlParser: true },
```

**After:**
```javascript
const mongoUrl = process.env.MONGODB_URL || 'mongodb://host.docker.internal:27017/swfavorites';

mongoose.connect(
  mongoUrl,
  { useNewUrlParser: true },
```

**11.2 Rebuild image:**

```bash
docker build -t favorite-node:env .
```

**11.3 Run with custom MongoDB URL:**

**Mac/Windows:**
```bash
docker run --name favorites -d --rm \
  -p 3000:3000 \
  -e MONGODB_URL='mongodb://host.docker.internal:27017/swfavorites' \
  favorite-node:env
```

**Linux:**
```bash
docker run --name favorites -d --rm \
  --add-host=host.docker.internal:host-gateway \
  -p 3000:3000 \
  -e MONGODB_URL='mongodb://host.docker.internal:27017/swfavorites' \
  favorite-node:env
```

**11.4 Test:**

```bash
curl http://localhost:3000/favorites
```

✅ **Works with environment variable configuration!**

**Benefits:**
- Different environments can use different connection strings
- No code changes needed for dev/staging/prod
- Can use environment-specific database hosts

### Step 12: Cleanup

```bash
# Stop container
docker stop favorites

# Remove images
docker rmi favorite-node:host-network favorite-node:env

# Optional: Clean MongoDB data
mongosh
use swfavorites
db.favorites.deleteMany({})
exit
```

## Comparison: Case 1 vs Case 2

### Case 1: Container → WWW

| Aspect | Details |
|--------|---------|
| **Target** | External internet services (APIs) |
| **Configuration** | None needed |
| **Works by default** | ✅ Yes |
| **Example** | `axios.get('https://swapi.dev/api/films')` |

### Case 2: Container → Host

| Aspect | Details |
|--------|---------|
| **Target** | Host machine services (MongoDB, PostgreSQL) |
| **Configuration** | Requires `host.docker.internal` or host IP |
| **Works by default** | ❌ No (`localhost` fails) |
| **Example** | `mongoose.connect('mongodb://host.docker.internal:27017/db')` |
| **Platform differences** | Linux needs `--add-host` flag |

## Platform-Specific Solutions Reference

| Platform | MongoDB Config | Docker Command | Notes |
|----------|---------------|----------------|-------|
| **Docker Desktop (Mac)** | Default (`bindIp: 127.0.0.1`) | `docker run -p 3000:3000 myapp` | `host.docker.internal` works automatically |
| **Docker Desktop (Windows)** | Default (`bindIp: 127.0.0.1`) | `docker run -p 3000:3000 myapp` | `host.docker.internal` works automatically |
| **Linux** | `bindIp: 127.0.0.1,172.17.0.1` | `docker run --add-host=host.docker.internal:host-gateway -p 3000:3000 myapp` | Requires both MongoDB config AND --add-host flag |
| **Alternative (All)** | `bindIp: 0.0.0.0` | `docker run -e DB_HOST=<HOST_IP> -p 3000:3000 myapp` | Less secure, use host IP directly |

## Common Commands Reference

| Command | Description |
|---------|-------------|
| `docker run --add-host=host.docker.internal:host-gateway` | Enable host.docker.internal on Linux |
| `docker network inspect bridge \| grep Gateway` | Find Docker bridge gateway IP (usually 172.17.0.1) |
| `sudo nano /etc/mongod.conf` | Edit MongoDB configuration |
| `sudo systemctl restart mongod` | Restart MongoDB after config changes |
| `sudo netstat -tuln \| grep 27017` | Check which IPs MongoDB is listening on |
| `docker exec <c> cat /etc/hosts` | View container's DNS entries |
| `mongosh` | Connect to MongoDB shell |
| `sudo systemctl status mongod` | Check MongoDB status |
| `hostname -I \| awk '{print $1}'` | Get host machine IP |
| `docker logs <container>` | Check connection errors |

## Troubleshooting

**Container exits immediately / Connection refused:**

```bash
# Check MongoDB is running on host
sudo systemctl status mongod

# Check MongoDB is listening
sudo netstat -tuln | grep 27017

# Check container logs for error details
docker logs favorites
```

**"MongoServerSelectionError" or "ECONNREFUSED 172.17.0.1:27017" (Linux):**

**Problem:** MongoDB is only listening on `127.0.0.1`, not on Docker bridge IP `172.17.0.1`

**Solution:**

1. **Check current MongoDB binding:**
```bash
sudo netstat -tuln | grep 27017
```

If you only see one line with `127.0.0.1:27017`, MongoDB isn't listening on Docker bridge.

2. **Edit MongoDB config:**
```bash
sudo nano /etc/mongod.conf
```

3. **Update bindIp:**
```yaml
net:
  port: 27017
  bindIp: 127.0.0.1,172.17.0.1
```

4. **Restart MongoDB:**
```bash
sudo systemctl restart mongod
```

5. **Verify:**
```bash
sudo netstat -tuln | grep 27017
```

Should show TWO lines now (127.0.0.1 and 172.17.0.1).

6. **Restart container:**
```bash
docker stop favorites
docker run --name favorites -d --rm \
  --add-host=host.docker.internal:host-gateway \
  -p 3000:3000 \
  favorite-node:host-network
```

**"MongoServerSelectionError" or "ECONNREFUSED" (Mac/Windows):**

**Problem:** Container cannot reach host MongoDB

**Solutions:**

1. **Verify host.docker.internal works:**
```bash
docker run --rm alpine ping -c 3 host.docker.internal
```

2. **Linux users - ensure --add-host flag:**
```bash
docker run --add-host=host.docker.internal:host-gateway ...
```

3. **Check MongoDB binding:**
```bash
# Should show 127.0.0.1 or 0.0.0.0
sudo netstat -tuln | grep 27017
```

4. **Try host IP instead:**
```bash
# Get host IP
hostname -I | awk '{print $1}'

# Use in connection string
mongoose.connect('mongodb://192.168.1.100:27017/swfavorites')
```

**Data not persisting across container restarts:**

✅ **This is expected and correct!**

- Data lives in **host MongoDB**, not in container
- New containers read from same host database
- If you can't see data, check you're querying the right database

**"Cannot find module 'mongoose'":**

```bash
# Rebuild image (dependencies not installed)
docker build -t favorite-node:host-network .
```

**Port 3000 already in use:**

```bash
# Check what's using the port
lsof -i :3000

# Use different port
docker run -p 8080:3000 favorite-node:host-network
```

## What You Learned

In this lab, you:
- ✅ Solved the Container → Host communication challenge
- ✅ Used `host.docker.internal` DNS name to reach host services
- ✅ Handled platform-specific differences (Mac/Windows vs Linux)
- ✅ Connected containerized applications to host MongoDB
- ✅ Performed full CRUD operations from container to host database
- ✅ Verified data persistence in host MongoDB
- ✅ Implemented environment variables for flexible configuration
- ✅ Understood when to use host networking vs container networking

**Key Takeaway:** Docker provides `host.docker.internal` as a special DNS name that resolves to the host machine, allowing containers to access host services. On Linux, this requires the `--add-host=host.docker.internal:host-gateway` flag. While this solution works, running databases as containers (Case 3) is often preferred for better isolation and portability!

**Next Steps:**
- Learn Container → Container communication with Docker networks
- Run MongoDB as a separate container
- Connect multiple containers on custom networks
- Implement microservices architecture with docker-compose