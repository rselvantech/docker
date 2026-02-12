# Docker Container Networking Lab - Communicate with External APIs

## Lab Overview

This hands-on lab introduces Docker container networking by exploring three essential communication patterns. 
You'll learn how containers communicate with the 
case-1 : outside world (This Demo) 
Case-2 : the host machine
case-2 : and other containers, while troubleshooting real-world networking challenges with MongoDB and external APIs.

**What you'll do:**
- Understand Docker's isolated network architecture
- Test Container-to-WWW communication with external APIs
- Diagnose and solve Container-to-Host communication issues
- Prepare for Container-to-Container communication patterns
- Debug common networking failures using logs and inspection
- Learn why `localhost` behaves differently inside containers

## Prerequisites

**Required Software:**
- Docker client and daemon installed and running
- Text editor or IDE
- Terminal with curl or HTTP client

**Knowledge Requirements:**
- Basic understanding of Docker images and containers
- Familiarity with REST APIs
- Basic networking concepts (localhost, ports, IP addresses)
- Node.js and Express.js fundamentals helpful

## Lab Objectives

By the end of this lab, you will be able to:

1. ✅ Understand Docker container network isolation
2. ✅ Test external HTTP requests from containers (Container → WWW)
3. ✅ Identify why `localhost` fails inside containers
4. ✅ Diagnose MongoDB connection failures between container and host
5. ✅ Use Docker logs to troubleshoot networking issues
6. ✅ Temporarily workaround database connections for testing
7. ✅ Prepare for multi-container networking solutions

## Demo Application

### Star Wars Favorites API

A Node.js/Express REST API that manages favorite Star Wars movies and characters while fetching data from external APIs.

**Application Structure:**
```
09-network-case1-external-apis/
├── README.md                       # This file
└── src/
    ├── app.js                 # Main Express application
    ├── package.json           # Dependencies (express, mongoose, axios)
    ├── Dockerfile             # Image definition
    └── models/
        └── favorite.js        # MongoDB schema for favorites
```

**Application Features:**
- **External API Integration:** Fetches Star Wars data from swapi.dev
- **Database Operations:** Stores favorites in MongoDB
- **RESTful Endpoints:**
  - `GET /movies` - Fetch movies from external API (Container → WWW)
  - `GET /people` - Fetch characters from external API (Container → WWW)
  - `GET /favorites` - List saved favorites (requires MongoDB)
  - `POST /favorites` - Save new favorite (requires MongoDB)

**Dependencies:**
- `express` - Web framework
- `axios` - HTTP client for external API calls
- `mongoose` - MongoDB ODM
- `body-parser` - Parse JSON requests

## Understanding Docker Container Networking

### Three Types of Network Communication

Docker containers need to communicate with three different targets:

| Type | Description | Example | Difficulty |
|------|-------------|---------|-----------|
| **Container → WWW** | External internet services | API calls, package downloads | ✅ Easy (works by default) |
| **Container → Host** | Host machine services | Host MongoDB, PostgreSQL | ⚠️ Tricky (localhost doesn't work) |
| **Container → Container** | Other Docker containers | Microservices, databases | ⚠️ Requires Docker networks |

### The `localhost` Problem

**On your host machine:**
```
localhost = 127.0.0.1 = Your computer
```

**Inside a Docker container:**
```
localhost = 127.0.0.1 = The container itself (NOT your computer)
```

**This causes failures:**
```javascript
// In container, trying to connect to host MongoDB
mongoose.connect('mongodb://localhost:27017/swfavorites')
// ❌ FAILS! Container looks for MongoDB inside itself
```

### Network Isolation by Default

**Each container:**
- Gets its own network namespace
- Has its own `localhost` (loopback interface)
- Cannot see host processes on `localhost`
- Can access WWW through Docker's network bridge
- Isolated from other containers by default

**Visual representation:**
```
┌─────────────────────────────────────────────┐
│           Your Host Machine                 │
│                                             │
│  MongoDB running on localhost:27017         │
│                                             │
│  ┌────────────────────────────────────┐     │
│  │      Docker Container              │     │
│  │                                    │     │
│  │  App tries: localhost:27017        │     │
│  │  ❌ Fails - looks inside container │     │
│  │  ✅ Can reach: swapi.dev (WWW)     │     │
│  └────────────────────────────────────┘     │
└─────────────────────────────────────────────┘
```

## Lab Instructions

### Step 1: Setup Project Files

**1.1 Create project structure:**

```bash
mkdir -p 09-networks-demo/src/models
cd 09-networks-demo/src
```

**1.2 Create `package.json`:**

**1.3 Create `models/favorite.js`:**

**1.4 Create `app.js`:**

**Important:** MongoDB connection is active and will cause container to fail (we'll debug this).

**1.5 Create `Dockerfile`:**

### Step 2: Build the Docker Image

**2.1 Build the image:**

```bash
docker build -t favorite-node .
```

**Expected output:**
```
[+] Building 45.2s (10/10) FINISHED
 => [internal] load build definition from Dockerfile
 => => transferring dockerfile: 138B
 => [internal] load .dockerignore
 => [internal] load metadata for docker.io/library/node:latest
 => [1/5] FROM node
 => [internal] load build context
 => [2/5] WORKDIR /app
 => [3/5] COPY package.json .
 => [4/5] RUN npm install
 => [5/5] COPY . .
 => exporting to image
 => => naming to docker.io/library/favorite-node:latest
```

**2.2 Verify image:**

```bash
docker images | grep favorite-node
```

**Output:**
```
favorite-node   latest   abc123def456   10 seconds ago   1.1GB
```

✅ **Image built successfully!**

### Step 3: First Run Attempt - Container Crashes

**3.1 Run the container:**

```bash
docker run --name favorites -d --rm -p 31000:3000 favorite-node
```

**Command breakdown:**
- `--name favorites` - Container name
- `-d` - Detached mode (background)
- `--rm` - Auto-remove when stopped
- `-p 3000:3000` - Map host port 3000 to container port 3000
- `favorite-node` - Image name

**3.2 Check if container is running:**

```bash
docker ps
```

**Expected output:**
```
CONTAINER ID   IMAGE   COMMAND   CREATED   STATUS   PORTS   NAMES
```

⚠️ **Empty! Container exited immediately!**

**3.3 Check stopped containers:**

```bash
docker ps -a
```

**Note:** Since we used `--rm`, the container is automatically removed. We won't see it here either.

### Step 4: Debugging - Run in Foreground Mode

**4.1 Run without `-d` flag to see errors:**

```bash
docker run --name favorites --rm -p 31000:3000 favorite-node
```

**Expected error output:**
```
MongoNetworkError: failed to connect to server [localhost:27017] on first connect [Error: connect ECONNREFUSED 127.0.0.1:27017
    at TCPConnectWrap.afterConnect [as oncomplete] (node:net:1705:16) {
  name: 'MongoNetworkError'
}]
    at Pool.<anonymous> (/app/node_modules/mongodb/lib/core/topologies/server.js:441:11)
    at Pool.emit (node:events:508:20)
    at /app/node_modules/mongodb/lib/core/connection/pool.js:564:14
    at /app/node_modules/mongodb/lib/core/connection/pool.js:1000:11
    at /app/node_modules/mongodb/lib/core/connection/connect.js:32:7
    at callback (/app/node_modules/mongodb/lib/core/connection/connect.js:300:5)
    at Socket.<anonymous> (/app/node_modules/mongodb/lib/core/connection/connect.js:330:7)
    at Object.onceWrapper (node:events:623:12)
    at Socket.emit (node:events:508:20)
    at emitErrorNT (node:internal/streams/destroy:170:8)
    at emitErrorCloseNT (node:internal/streams/destroy:129:3)
    at process.processTicksAndRejections (node:internal/process/task_queues:90:21)
```

**Key error:** `ECONNREFUSED 127.0.0.1:27017`

**4.2 Press `Ctrl+C` to stop**

### Step 5: Understanding the Failure

**Why it failed:**

**In `app.js`, line 61:**
```javascript
mongoose.connect(
  'mongodb://localhost:27017/swfavorites',
  //      ^^^^^^^^^ This is the problem!
```

**Analysis:**
1. **On host machine:** MongoDB is running on `localhost:27017`
2. **Container starts:** Tries to connect to `mongodb://localhost:27017`
3. **Inside container:** `localhost` = container itself (NOT host)
4. **MongoDB is NOT inside container:** Connection fails
5. **App crashes:** Server never starts

**What the container includes:**
- ✅ Node.js runtime
- ✅ Application code
- ✅ npm dependencies

**What the container does NOT include:**
- ❌ MongoDB installation
- ❌ MongoDB data
- ❌ Host machine services

**Container perspective:**
```
Container thinks:
"Connect to localhost:27017"
"Let me check inside myself..."
"No MongoDB here!"
"ECONNREFUSED"
```

### Step 6: Temporary Workaround - Test WWW Communication

**Objective:** Verify external HTTP requests work (Container → WWW communication)

**6.1 Edit `app.js` - Comment out MongoDB and move app.listen:**

**Before (lines 61-70):**
```javascript
mongoose.connect(
  'mongodb://localhost:27017/swfavorites',
  { useNewUrlParser: true },
  (err) => {
    if (err) {
      console.log(err);
    } else {
      app.listen(3000);
    }
  }
);
```

**After:**
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

**What changed:**
- MongoDB connection code commented out
- `app.listen(3000)` moved outside connection callback
- Server starts regardless of database

**6.2 Save the file**

### Step 7: Rebuild Image with Changes

**7.1 Rebuild (code changed):**

```bash
docker build -t favorite-node .
```

**Why rebuild?**
- Modified `app.js`
- Changes must be copied into new image
- Old image override with new code

**7.2 Run the updated container:**

```bash
docker run --name favorites -d --rm -p 31000:3000 favorite-node
```

**7.3 Verify container is running:**

```bash
docker ps
```

**Expected output:**
```
CONTAINER ID   IMAGE           COMMAND           CREATED          STATUS          PORTS                    NAMES
abc123def456   favorite-node   "node app.js"     5 seconds ago    Up 4 seconds    0.0.0.0:31000->3000/tcp   favorites
```

✅ **Container is running!** Status shows "Up".

### Step 8: Test Container → WWW Communication

**8.1 Test `/movies` endpoint (external API call):**

```bash
curl http://localhost:31000/movies
```

**Or in browser:** `http://localhost:31000/movies`

**Expected output (truncated):**
```json
{
  "movies": {
    "count": 6,
    "results": [
      {
        "title": "A New Hope",
        "episode_id": 4,
        "opening_crawl": "It is a period of civil war...",
        "director": "George Lucas",
        "producer": "Gary Kurtz, Rick McCallum",
        "release_date": "1977-05-25",
        "url": "https://swapi.dev/api/films/1/"
      },
      ...
    ]
  }
}
```

✅ **Success! Container can make external HTTP requests!**

**What happened:**
1. Your browser/curl → Container on port 3000
2. Container receives request
3. Container makes HTTP request to `https://swapi.dev/api/films` (WWW)
4. External API responds
5. Container forwards response to you

**8.2 Test `/people` endpoint:**

```bash
curl http://localhost:31000/people
```

**Expected output:**
```json
{
  "people": {
    "count": 82,
    "results": [
      {
        "name": "Luke Skywalker",
        "height": "172",
        "mass": "77",
        "hair_color": "blond",
        "eye_color": "blue",
        "birth_year": "19BBY",
        "gender": "male",
        "url": "https://swapi.dev/api/people/1/"
      },
      ...
    ]
  }
}
```

✅ **Also works! External API communication confirmed!**

### Step 9: Verify Database Endpoints Fail

**9.1 Test `/favorites` endpoint (requires MongoDB):**

```bash
curl http://localhost:31000/favorites
```

**Expected error:**
```
Cannot GET /favorites
```

Or application may crash depending on error handling.

**9.2 Check logs:**

```bash
docker logs favorites
```

If there are errors accessing `/favorites`, they'll appear here.

**Why it fails:**
- MongoDB connection is commented out
- No database to query
- Endpoints requiring MongoDB don't work

**This is expected!** We're only testing WWW communication in this step.

### Step 10: Inspect Container Networking

**10.1 Inspect container network settings:**

```bash
docker inspect favorites -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}'
```

**Expected output:**
```
172.17.0.2
```

This is the container's IP address inside Docker's bridge network.

**10.2 View full network configuration:**

```bash
docker inspect favorites | grep -A 60 "NetworkSettings"
```

**Sample output:**
```json
        "NetworkSettings": {
            "Bridge": "",
            "SandboxID": "913c7921eac3346cb17a5f6d5eb4a39edaed8cc558c09ec0ab18c3dc947138b1",
            "SandboxKey": "/var/run/docker/netns/913c7921eac3",
            "Ports": {
                "3000/tcp": [
                    {
                        "HostIp": "0.0.0.0",
                        "HostPort": "31000"
                    },
                    {
                        "HostIp": "::",
                        "HostPort": "31000"
                    }
                ]
            },
            "HairpinMode": false,
            "LinkLocalIPv6Address": "",
            "LinkLocalIPv6PrefixLen": 0,
            "SecondaryIPAddresses": null,
            "SecondaryIPv6Addresses": null,
            "EndpointID": "6d8d4958c6af424d4267bdd9f28f6c6cee2662149139ab317dc2c221cdb68749",
            "Gateway": "172.17.0.1",
            "GlobalIPv6Address": "",
            "GlobalIPv6PrefixLen": 0,
            "IPAddress": "172.17.0.2",
            "IPPrefixLen": 16,
            "IPv6Gateway": "",
            "MacAddress": "7a:e4:8e:bc:3c:e4",
            "Networks": {
                "bridge": {
                    "IPAMConfig": null,
                    "Links": null,
                    "Aliases": null,
                    "MacAddress": "7a:e4:8e:bc:3c:e4",
                    "DriverOpts": null,
                    "GwPriority": 0,
                    "NetworkID": "69dfc2a90c0f23e2ed587ed56bbc7dfd742cf9dc729fa7b0ac376499dfd9aa36",
                    "EndpointID": "6d8d4958c6af424d4267bdd9f28f6c6cee2662149139ab317dc2c221cdb68749",
                    "Gateway": "172.17.0.1",
                    "IPAddress": "172.17.0.2",
                    "IPPrefixLen": 16,
                    "IPv6Gateway": "",
                    "GlobalIPv6Address": "",
                    "GlobalIPv6PrefixLen": 0,
                    "DNSNames": null
                }
            }
        }
    }
]
```

**Understanding the output:**
- **Gateway:** `172.17.0.1` - Docker bridge gateway (host)
- **IPAddress:** `172.17.0.2` - Container's IP
- **Ports:** `3000/tcp` mapped to host `0.0.0.0:31000`

### Step 11: Cleanup

```bash
# Stop container (also removes due to --rm flag)
docker stop favorites

# Verify stopped
docker ps -a

# Remove image
docker rmi favorite-node
```

## Case Studies Summary

### Case 1: Container → WWW Communication ✅

**Status:** Works by default

**What we tested:**
- External HTTP requests to `swapi.dev`
- Container can access any public internet service

**How it works:**
```
Container → Docker Bridge → Host Network → Internet
```

**Example:**
```javascript
const response = await axios.get('https://swapi.dev/api/films');
// ✅ Works perfectly!
```

**Use cases:**
- API calls to external services
- Downloading packages during build
- Accessing cloud services

### Case 2: Container → Host Machine Communication ❌

**Status:** Fails with `localhost`

**What we discovered:**
- `localhost` inside container ≠ host machine
- MongoDB on host unreachable via `localhost:27017`
- Container crashes with `ECONNREFUSED`

**Why it fails:**
```javascript
mongoose.connect('mongodb://localhost:27017/swfavorites');
// ❌ Fails - container looks inside itself, not at host
```

**Solution preview:**
- Use special DNS name `host.docker.internal` (next demo)
- Or run MongoDB in another container
- Or use container's IP and expose ports correctly

### Case 3: Container → Container Communication

**Status:** Not tested yet (future demo)

**Next steps:**
- Run MongoDB in a separate container
- Create Docker network
- Connect containers on same network
- Use container names as DNS

## Common Commands Reference

| Command | Description |
|---------|-------------|
| `docker run -p 3000:3000` | Map host port to container port |
| `docker ps` | List running containers |
| `docker logs <container>` | View container output |
| `docker logs -f <container>` | Follow logs in real-time |
| `docker inspect <container>` | View detailed container info |
| `docker exec <c> printenv` | Check environment inside container |
| `docker stop <container>` | Stop running container |

## Troubleshooting

**Port already in use:**
```bash
# Check what's using port 3000
lsof -i :3000  # Mac/Linux

# Use different port
docker run -p 8080:3000 favorite-node
```

**Cannot access external APIs:**
```bash
# Check container can reach internet
docker exec <container> ping -c 3 google.com

# Check DNS resolution
docker exec <container> nslookup swapi.dev
```

## What You Learned

In this lab, you:
- ✅ Understood Docker's network isolation model
- ✅ Tested Container → WWW communication successfully
- ✅ Identified why `localhost` fails inside containers
- ✅ Diagnosed MongoDB connection failures using logs
- ✅ Learned containers have their own network namespace
- ✅ Used `docker inspect` to view network configuration
- ✅ Differentiated between host network and container network
- ✅ Prepared foundation for multi-container networking

**Key Takeaway:** Docker containers are isolated network environments. While they can easily access the internet (Container → WWW), communicating with host services or other containers requires understanding Docker networking concepts. The `localhost` inside a container refers to the container itself, NOT the host machine!

**Next Steps:**
- Learn Container → Host communication using `host.docker.internal`
- Explore Container → Container communication with Docker networks
- Run MongoDB as a container and connect services
- Implement multi-container applications with docker-compose