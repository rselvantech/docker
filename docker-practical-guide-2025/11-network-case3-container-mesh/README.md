# Docker Container to Container Communication Lab

## Lab Overview

This hands-on lab builds upon [09-network-case1-external-apis](../09-network-case1-external-apis/) and [10-network-case2-host-services](../10-network-case2-host-services/) to implement the most production-ready networking pattern: Container → Container communication. You'll learn how to create custom Docker networks, run MongoDB as a container, and connect multiple containers using Docker's built-in DNS resolution.

**What you'll do:**
- Create custom Docker networks for container isolation
- Run MongoDB as a Docker container instead of host service
- Connect application containers to database containers
- Use container names as DNS hostnames
- Understand Docker's automatic DNS resolution
- Implement a complete multi-container application architecture
- Compare all three networking cases (WWW, Host, Container)

## Prerequisites

**Required Software:**
- Docker client and daemon installed and running
- Text editor or IDE
- Terminal with curl or HTTP client

**Knowledge Requirements:**
- **REQUIRED:** Completion of [09-network-case1-external-apis](../09-network-case1-external-apis/)
- **REQUIRED:** Completion of [10-network-case2-host-services](../10-network-case2-host-services/)
- Understanding of Docker networks concept
- Basic knowledge of multi-container applications

**Important:**
- ✅ No MongoDB installation on host required!
- ✅ MongoDB will run as a Docker container
- ✅ Works identically on Mac, Windows, and Linux

## Lab Objectives

By the end of this lab, you will be able to:

1. ✅ Create custom Docker networks
2. ✅ Run MongoDB in a Docker container
3. ✅ Connect containers on the same network
4. ✅ Use container names for DNS resolution
5. ✅ Understand Docker's automatic service discovery
6. ✅ Manage multi-container applications
7. ✅ Implement production-ready container networking
8. ✅ Compare all three networking patterns

## Demo Application

### Star Wars Favorites API with Containerized MongoDB

The same Node.js/Express application, now connecting to MongoDB running in another container.

**Application Structure:**
```
11-network-case3-container-mesh/
├── README.md                  # This file
└── src/
    ├── app.js                 # UPDATED: Connect to containerized MongoDB
    ├── package.json           # Same dependencies
    ├── Dockerfile             # Same image definition
    └── models/
        └── favorite.js        # MongoDB schema
```

**What's different from Case 2:**
- MongoDB connection uses **container name** instead of `host.docker.internal`
- MongoDB runs as a **separate container**
- Both containers connected via **custom Docker network**
- No host MongoDB configuration needed

**Architecture:**
```
┌──────────────────────────────────────────────────┐
│         Custom Docker Network: favorites-net     │
│                                                  │
│  ┌─────────────────┐      ┌──────────────────┐  │
│  │   mongodb        │      │   favorites-app  │  │
│  │   (Container)    │◄─────│   (Container)    │  │
│  │                  │      │                  │  │
│  │   Port: 27017    │      │   Port: 3000     │  │
│  │   DNS: mongodb   │      │   DNS: favorites │  │
│  └─────────────────┘      └──────────────────┘  │
│         ▲                         │              │
│         │                         │              │
│         │                         ▼              │
│         │                  Host Port 3000        │
└─────────┼──────────────────────────┬─────────────┘
          │                          │
          │                          ▼
       Volume                   Your Browser
   (Data Persistence)        http://localhost:3000
```

## Understanding Container to Container Networking

### Why Container → Container is Best Practice

**Compared to Container → Host (Case 2):**

| Aspect | Container → Host | Container → Container |
|--------|------------------|----------------------|
| **Portability** | ❌ Host-dependent | ✅ Fully portable |
| **Isolation** | ⚠️ Shared host resources | ✅ Complete isolation |
| **Configuration** | Platform-specific (Linux needs extra setup) | ✅ Same everywhere |
| **Deployment** | Complex (host setup required) | ✅ Simple (just Docker) |
| **Scaling** | Hard (single host) | ✅ Easy (orchestration) |
| **Production-ready** | ⚠️ Not recommended | ✅ Industry standard |

### Docker Networks Explained

**Default Networks:**

Docker creates three default networks:

```bash
docker network ls
```

**Output:**
```
NETWORK ID     NAME      DRIVER    SCOPE
abc123def456   bridge    bridge    local
def456abc789   host      host      local
789abc123def   none      null      local
```

**Network types:**
- **bridge** (default): Isolated network for containers
- **host**: Container shares host's network stack
- **none**: No networking

**Custom Networks (What we'll use):**
- User-defined bridge networks
- Automatic DNS resolution between containers
- Better isolation and control
- Recommended for production

### Container DNS Resolution

**In a custom Docker network:**

```javascript
// Container name becomes hostname!
mongoose.connect('mongodb://mongodb:27017/swfavorites')
//                        ^^^^^^^^ Container name, not IP
```

**How it works:**
1. Container `favorites-app` tries to connect to `mongodb:27017`
2. Docker's embedded DNS server resolves `mongodb` → container IP
3. Connection established automatically
4. No IPs, no `host.docker.internal`, no platform differences!

**Magic of Docker DNS:**
```
Container: "Where is 'mongodb'?"
Docker DNS: "That's container 'mongodb' at IP 172.18.0.2"
Container: "Thanks! Connecting..."
✅ Connection successful
```

## Lab Instructions

### Step 1: Create Custom Docker Network

**1.1 Create a new bridge network:**

```bash
docker network create favorites-net
```

**Expected output:**
```
abc123def456789012345678901234567890123456789012345678901234
```

This is the network ID.

**1.2 Verify network was created:**

```bash
docker network ls
```

**Expected output:**
```
NETWORK ID     NAME            DRIVER    SCOPE
abc123def456   bridge          bridge    local
def456abc789   favorites-net   bridge    local
789abc123def   host            host      local
...
```

✅ **Custom network `favorites-net` created!**

**1.3 Inspect the network:**

```bash
docker network inspect favorites-net
```

**Expected output (truncated):**
```json
[
    {
        "Name": "favorites-net",
        "Driver": "bridge",
        "IPAM": {
            "Config": [
                {
                    "Subnet": "172.18.0.0/16",
                    "Gateway": "172.18.0.1"
                }
            ]
        },
        "Containers": {}
    }
]
```

**Key information:**
- Network has its own subnet (172.18.x.x - different from default 172.17.x.x)
- No containers connected yet
- Gateway: 172.18.0.1

### Step 2: Run MongoDB Container

**2.1 Run MongoDB on the custom network:**

```bash
docker run -d \
  --name mongodb \
  --network favorites-net \
  mongo
```

**Command breakdown:**
- `-d` - Detached mode (background)
- `--name mongodb` - Container name (becomes DNS hostname!)
- `--network favorites-net` - Connect to our custom network
- `mongo` - Official MongoDB image from Docker Hub

**Expected output:**
```
Unable to find image 'mongo:latest' locally
latest: Pulling from library/mongo
...
Status: Downloaded newer image for mongo:latest
abc123def456789...
```

**First run:** Downloads MongoDB image (~700MB)
**Subsequent runs:** Uses cached image

**2.2 Verify MongoDB container is running:**

```bash
docker ps
```

**Expected output:**
```
CONTAINER ID   IMAGE   COMMAND                  CREATED         STATUS         PORTS       NAMES
abc123def456   mongo   "docker-entrypoint.s…"   10 seconds ago  Up 9 seconds   27017/tcp   mongodb
```

**2.3 Check MongoDB logs:**

```bash
docker logs mongodb
```

**Expected output (last lines):**
```
{"t":{"$date":"2026-02-12T05:30:10.123Z"},"s":"I","c":"NETWORK","msg":"Waiting for connections","attr":{"port":27017}}
```

✅ **MongoDB is ready and waiting for connections on port 27017!**

**2.4 Inspect network to see connected container:**

```bash
docker network inspect favorites-net
```

**Expected output (containers section):**
```json
"Containers": {
    "abc123def456...": {
        "Name": "mongodb",
        "IPv4Address": "172.18.0.2/16",
        "MacAddress": "02:42:ac:12:00:02"
    }
}
```

**Note:** MongoDB got IP `172.18.0.2` on our custom network.

### Step 3: Setup Application Files

**3.1 Create project structure:**

```bash
mkdir -p 11-network-case3-container-mesh/src/models
cd 11-network-case3-container-mesh/src
```

**3.2 Copy files from Case 1:**

```bash
# Copy all files
cp -r ../../09-network-case1-external-apis/src/* .
```

**Files needed:**
- `package.json`
- `Dockerfile`
- `models/favorite.js`
- `app.js` (we'll modify this)

### Step 4: Update Application Code for Container Network

**4.1 Open `app.js` in your editor**

**4.2 Update MongoDB connection string:**

**Find the connection section (lines 61-70):**

**Before (from Case 2):**
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
```

**After (Case 3 - Container name):**
```javascript
mongoose.connect(
  'mongodb://mongodb:27017/swfavorites',
  { useNewUrlParser: true, useUnifiedTopology: true },
  (err) => {
    if (err) {
      console.log(err);
    } else {
      app.listen(3000);
    }
  }
);
```

**What changed:**
- ✅ `host.docker.internal` → `mongodb` (container name)
- ✅ Added `useUnifiedTopology: true` (removes deprecation warning)
- Container name `mongodb` will be DNS-resolved by Docker

**4.3 Save the file**

**Key concept:**
- Container name `mongodb` is automatically registered in Docker's DNS
- No IPs, no special DNS names, just the container name!
- Works on all platforms (Mac, Windows, Linux) identically

### Step 5: Build Application Image

**5.1 Build the image:**

```bash
docker build -t favorite-node:container-network .
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
 => => naming to docker.io/library/favorite-node:container-network
```

**5.2 Verify image:**

```bash
docker images | grep favorite-node
```

**Output:**
```
favorite-node   container-network   abc123def456   30 seconds ago   1.1GB
```

✅ **Image ready with container networking configuration!**

### Step 6: Run Application Container on Same Network

**6.1 Run the application container:**

```bash
docker run -d \
  --name favorites-app \
  --network favorites-net \
  -p 3000:3000 \
  favorite-node:container-network
```

**Command breakdown:**
- `--name favorites-app` - Container name
- `--network favorites-net` - **Same network as MongoDB!**
- `-p 3000:3000` - Expose port to host
- No `--add-host` needed!
- No platform-specific flags!

**Expected output:**
```
def456abc789012345678901234567890123456789012345678901234567890
```

**6.2 Verify both containers are running:**

```bash
docker ps
```

**Expected output:**
```
CONTAINER ID   IMAGE                            COMMAND                  CREATED          STATUS          PORTS                    NAMES
def456abc789   favorite-node:container-network  "node app.js"            10 seconds ago   Up 9 seconds    0.0.0.0:3000->3000/tcp   favorites-app
abc123def456   mongo                            "docker-entrypoint.s…"   2 minutes ago    Up 2 minutes    27017/tcp                mongodb
```

✅ **Both containers running on same network!**

**6.3 Check application logs:**

```bash
docker logs favorites-app
```

**Expected output:**
```
(No errors - clean logs mean successful MongoDB connection!)
```

**If you see deprecation warnings only (no ECONNREFUSED), that's perfect!**

### Step 7: Inspect Network Connectivity

**7.1 Inspect network with both containers:**

```bash
docker network inspect favorites-net
```

**Expected output (containers section):**
```json
"Containers": {
    "abc123def456...": {
        "Name": "mongodb",
        "IPv4Address": "172.18.0.2/16"
    },
    "def456abc789...": {
        "Name": "favorites-app",
        "IPv4Address": "172.18.0.3/16"
    }
}
```

**Notice:**
- MongoDB: `172.18.0.2`
- App: `172.18.0.3`
- Both on same `172.18.0.0/16` subnet

**7.2 Test DNS resolution from inside app container:**

```bash
docker exec favorites-app ping -c 3 mongodb
(OR)
docker exec favorites-app getent hosts mongodb
```

**Expected output:**
```
PING mongodb (172.18.0.2): 56 data bytes
64 bytes from 172.18.0.2: seq=0 ttl=64 time=0.123 ms
64 bytes from 172.18.0.2: seq=1 ttl=64 time=0.098 ms
64 bytes from 172.18.0.2: seq=2 ttl=64 time=0.105 ms
```

✅ **DNS resolution working! Container name `mongodb` resolves to `172.18.0.2`**

**7.3 Test reverse - ping app from MongoDB container:**

```bash
docker exec mongodb ping -c 3 favorites-app
(OR)
docker exec mongodb getent hosts favorites-app
```

**Expected output:**
```
PING favorites-app (172.18.0.3): 56 data bytes
64 bytes from 172.18.0.3: seq=0 ttl=64 time=0.115 ms
...
```

✅ **Bi-directional DNS works!**

### Step 8: Test Application with Container → Container Communication

**8.1 Test GET /favorites:**

```bash
curl http://localhost:3000/favorites
```

**Expected output:**
```json
{
  "favorites": []
}
```

✅ **App connected to containerized MongoDB!**

**8.2 Test POST /favorites:**

```bash
curl -X POST http://localhost:3000/favorites \
  -H "Content-Type: application/json" \
  -d '{
    "type": "movie",
    "name": "A New Hope",
    "url": "https://swapi.dev/api/films/1/"
  }'
```

**Expected output:**
```json
{
  "message": "Favorite saved!",
  "favorite": {
    "type": "movie",
    "name": "A New Hope",
    "url": "https://swapi.dev/api/films/1/",
    "_id": "65c1234567890abcdef12345"
  }
}
```

✅ **Data saved to containerized MongoDB!**

**8.3 Verify data retrieval:**

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
      "name": "A New Hope",
      "url": "https://swapi.dev/api/films/1/",
      "__v": 0
    }
  ]
}
```

**8.4 Test external API calls (Container → WWW):**

```bash
curl http://localhost:3000/movies
curl http://localhost:3000/people
```

Both should work!

✅ **All three communication types working:**
- ✅ Container → WWW (external APIs)
- ✅ Container → Container (MongoDB)
- ✅ Host → Container (your browser/curl)

### Step 9: Verify Data in MongoDB Container

**9.1 Connect to MongoDB shell inside container:**

```bash
docker exec -it mongodb mongosh
```

**Expected output:**
```
Current Mongosh Log ID: 65c1234567890abcdef12345
Connecting to:          mongodb://127.0.0.1:27017/
Using MongoDB:          7.0.x
...
test>
```

**9.2 Switch to swfavorites database:**

```javascript
use swfavorites
```

**Expected output:**
```
switched to db swfavorites
```

**9.3 Query favorites collection:**

```javascript
db.favorites.find().pretty()
```

**Expected output:**
```javascript
[
  {
    _id: ObjectId('65c1234567890abcdef12345'),
    type: 'movie',
    name: 'A New Hope',
    url: 'https://swapi.dev/api/films/1/',
    __v: 0
  }
]
```

✅ **Data is in the MongoDB container!**

**9.4 Exit MongoDB shell:**

```javascript
exit
```

### Step 10: Test Data Persistence with Volumes

**Currently, data is stored inside the container - it will be lost if container is removed!**

**10.1 Stop and remove MongoDB container:**

```bash
docker stop mongodb
docker rm mongodb
```

**10.2 Start new MongoDB container WITHOUT volume:**

```bash
docker run -d \
  --name mongodb \
  --network favorites-net \
  mongo
```

**10.3 Check favorites:**

```bash
curl http://localhost:3000/favorites
```

**Expected output:**
```json
{
  "favorites": []
}
```

❌ **Data lost! Container was ephemeral!**

**10.4 Stop and remove containers:**

```bash
docker stop mongodb favorites-app
docker rm mongodb favorites-app
```

**10.5 Create named volume for MongoDB:**

```bash
docker volume create mongodb-data
```

**10.6 Run MongoDB with volume:**

```bash
docker run -d \
  --name mongodb \
  --network favorites-net \
  -v mongodb-data:/data/db \
  mongo
```

**Command breakdown:**
- `-v mongodb-data:/data/db` - Mount named volume
- `/data/db` is MongoDB's data directory inside container

**10.7 Restart application container:**

```bash
docker run -d \
  --name favorites-app \
  --network favorites-net \
  -p 3000:3000 \
  favorite-node:container-network
```

**10.8 Add data again:**

```bash
curl -X POST http://localhost:3000/favorites \
  -H "Content-Type: application/json" \
  -d '{
    "type": "movie",
    "name": "The Empire Strikes Back",
    "url": "https://swapi.dev/api/films/2/"
  }'
```

**10.9 Stop and remove MongoDB container:**

```bash
docker stop mongodb
docker rm mongodb
```

**10.10 Start new MongoDB container with same volume:**

```bash
docker run -d \
  --name mongodb \
  --network favorites-net \
  -v mongodb-data:/data/db \
  mongo
```

**10.11 Check favorites:**

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

✅ **Data persisted! Volume survived container recreation!**

### Step 11: Environment Variables for Flexibility

**11.1 Update `app.js` to use environment variable:**

**Open `app.js` and modify:**

**Before:**
```javascript
mongoose.connect(
  'mongodb://mongodb:27017/swfavorites',
```

**After:**
```javascript
const mongoUrl = process.env.MONGODB_URL || 'mongodb://mongodb:27017/swfavorites';

mongoose.connect(
  mongoUrl,
```

**11.2 Rebuild image:**

```bash
docker build -t favorite-node:env-network .
```

**11.3 Stop current app:**

```bash
docker stop favorites-app
docker rm favorites-app
```

**11.4 Run with custom MongoDB URL:**

```bash
docker run -d \
  --name favorites-app \
  --network favorites-net \
  -p 3000:3000 \
  -e MONGODB_URL='mongodb://mongodb:27017/swfavorites' \
  favorite-node:env-network
```

**Benefits:**
- Can change database host without rebuilding
- Can connect to different MongoDB instances
- Production/staging/dev use same image

### Step 12: Add More Containers to Network

**You can add more containers to the same network!**

**12.1 Run second app instance on different port:**

```bash
docker run -d \
  --name favorites-app-2 \
  --network favorites-net \
  -p 3001:3000 \
  favorite-node:container-network
```

**12.2 Both apps share same MongoDB:**

```bash
# Add via first app
curl -X POST http://localhost:3000/favorites \
  -H "Content-Type: application/json" \
  -d '{"type":"character","name":"Yoda","url":"https://swapi.dev/api/people/20/"}'

# Retrieve via second app
curl http://localhost:3001/favorites
```

**Expected:** Both apps see same data!

✅ **Multiple containers sharing same database container!**

### Step 13: Cleanup

**13.1 Stop and remove all containers:**

```bash
docker stop favorites-app favorites-app-2 mongodb
docker rm favorites-app favorites-app-2 mongodb
```

**13.2 Remove network:**

```bash
docker network rm favorites-net
```

**13.3 Remove volumes:**

```bash
docker volume rm mongodb-data
```

**13.4 Remove images (optional):**

```bash
docker rmi favorite-node:container-network favorite-node:env-network mongo
```

## Comparison: All Three Networking Cases

### Case 1: Container → WWW (External APIs)

```javascript
// External HTTP requests
axios.get('https://swapi.dev/api/films')
```

**Characteristics:**
- ✅ Works by default
- ✅ No configuration needed
- ✅ Same on all platforms
- **Use for:** External services, APIs, downloads

### Case 2: Container → Host (Host Services)

```javascript
// Connect to host MongoDB
mongoose.connect('mongodb://host.docker.internal:27017/db')
```

**Characteristics:**
- ⚠️ Platform-specific (Linux needs extra config)
- ⚠️ Host must be configured
- ⚠️ Less portable
- **Use for:** Development only, legacy services

### Case 3: Container → Container (Best Practice)

```javascript
// Connect to MongoDB container
mongoose.connect('mongodb://mongodb:27017/db')
```

**Characteristics:**
- ✅ Fully portable
- ✅ Complete isolation
- ✅ Production-ready
- ✅ Easy to scale
- ✅ Same on all platforms
- **Use for:** Production, microservices, any multi-container app

## Networking Patterns Summary

| Pattern | Configuration | Portability | Isolation | Production | Complexity |
|---------|--------------|-------------|-----------|------------|------------|
| **Case 1: WWW** | None | ✅ Perfect | ✅ High | ✅ Yes | ⭐ Easy |
| **Case 2: Host** | Platform-specific | ⚠️ Medium | ⚠️ Low | ❌ No | ⭐⭐⭐ Complex |
| **Case 3: Container** | Docker network | ✅ Perfect | ✅ High | ✅ Yes | ⭐⭐ Moderate |

## Docker Networks Deep Dive

### Network Drivers

**Bridge (default):**
- Isolated network for containers on same host
- Containers can communicate with each other
- NAT to access external networks

**Host:**
- Container shares host's network stack
- No isolation
- Best performance (no NAT overhead)

**None:**
- No networking
- Complete isolation

**Custom bridge (what we used):**
- User-defined bridge network
- Automatic DNS resolution
- Better control and isolation

### DNS Resolution Rules

**In custom networks:**
- Container name = hostname
- Automatic DNS registration
- Containers can find each other by name

**In default bridge network:**
- No automatic DNS
- Must use `--link` (deprecated) or IPs

**This is why we created `favorites-net`!**

## Common Commands Reference

| Command | Description |
|---------|-------------|
| `docker network create <name>` | Create custom network |
| `docker network ls` | List networks |
| `docker network inspect <name>` | View network details |
| `docker network rm <name>` | Remove network |
| `docker run --network <name>` | Connect container to network |
| `docker network connect <net> <container>` | Connect running container to network |
| `docker network disconnect <net> <container>` | Disconnect container from network |
| `docker exec <c> ping <hostname>` | Test DNS resolution |
| `docker volume create <name>` | Create named volume |
| `docker volume ls` | List volumes |
| `docker volume rm <name>` | Remove volume |

## Troubleshooting

**Cannot connect to MongoDB container:**

```bash
# Verify both containers on same network
docker network inspect favorites-net

# Check MongoDB is running
docker ps | grep mongodb

# Test DNS resolution
docker exec favorites-app ping mongodb

# Check application logs
docker logs favorites-app
```

**"getaddrinfo ENOTFOUND mongodb":**

**Problem:** Containers not on same network

**Solution:**
```bash
# Check app container's network
docker inspect favorites-app -f '{{.NetworkSettings.Networks}}'

# Should show favorites-net, if not:
docker network connect favorites-net favorites-app
```

**Data lost after container restart:**

**Problem:** No volume mounted

**Solution:**
```bash
# Always use named volumes for databases
docker run -d \
  --name mongodb \
  --network favorites-net \
  -v mongodb-data:/data/db \
  mongo
```

**Port already in use:**

```bash
# Check what's using the port
lsof -i :3000

# Use different host port
docker run -p 8080:3000 ...
```

**Container cannot reach WWW:**

```bash
# Test internet connectivity
docker exec favorites-app ping -c 3 google.com

# Check DNS
docker exec favorites-app nslookup swapi.dev
```

## What You Learned

In this lab, you:
- ✅ Created custom Docker networks for container isolation
- ✅ Ran MongoDB as a Docker container
- ✅ Connected multiple containers on the same network
- ✅ Used container names for automatic DNS resolution
- ✅ Implemented data persistence with Docker volumes
- ✅ Built a complete multi-container application
- ✅ Compared all three networking patterns (WWW, Host, Container)
- ✅ Understood production-ready container networking
- ✅ Learned Docker's automatic service discovery
- ✅ Scaled applications with multiple container instances

**Key Takeaway:** Container-to-container communication using custom Docker networks is the production-ready approach for multi-container applications. Docker's built-in DNS resolution makes containers discoverable by name, eliminating platform-specific configurations and creating truly portable, isolated, and scalable applications. This is the foundation for microservices architectures and container orchestration platforms like Kubernetes!

**Next Steps:**
- Learn docker-compose for declarative multi-container definitions
- Explore container orchestration with Kubernetes
- Implement service meshes for advanced networking
- Study load balancing and service discovery patterns
- Build complex microservices architectures