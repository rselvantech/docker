# Docker Environment Variables Lab

## Lab Overview

This hands-on lab builds upon [03-data-volume-feedback-app](../03-data-volume-feedback-app/) to introduce Docker environment variables and build arguments. You'll learn how to create flexible, configurable containers that can adapt to different environments without rebuilding images, making your applications more dynamic and production-ready.

**What you'll do:**
- Understand the difference between build arguments (ARG) and environment variables (ENV)
- Use environment variables in application code
- Set environment variables in Dockerfile with ENV instruction
- Override environment variables at runtime with `--env` flag
- Use `.env` files for managing multiple environment variables
- Configure port numbers dynamically without rebuilding images

## Prerequisites

**Required Software:**
- Docker client and daemon installed and running
- Text editor or IDE

**Knowledge Requirements:**
- Completion of [03-data-volume-feedback-app](../03-data-volume-feedback-app/) recommended
- Basic understanding of Docker images and containers
- Familiarity with Node.js helpful

## Lab Objectives

By the end of this lab, you will be able to:

1. ✅ Understand build-time arguments (ARG) vs runtime environment variables (ENV)
2. ✅ Access environment variables in application code
3. ✅ Declare environment variables in Dockerfile with default values
4. ✅ Use environment variables in Dockerfile instructions
5. ✅ Override environment variables at runtime
6. ✅ Manage environment variables with `.env` files
7. ✅ Create flexible, configurable containers

## Demo Application

### Same Feedback Application with Configurable Port

This lab reuses the exact same feedback application from demo 03.

**For application details, refer to:**
- [03-data-volume-feedback-app README](../03-data-volume-feedback-app/README.md)

**Application Structure:**
```
08-environment-variables/
└── src/
    ├── server.js              # UPDATED: Use environment variable for port
    ├── package.json           # Same as demo 03
    ├── Dockerfile             # UPDATED: Add ENV instruction
    ├── .env                   # NEW: Environment variables file
    ├── pages/                 # Same as demo 03
    ├── styles/                # Same as demo 03
    ├── feedback/              # Runtime directory
    └── temp/                  # Runtime directory
```

**What's different:**
- `server.js` uses `process.env.PORT` instead of hardcoded port
- Dockerfile declares `ENV PORT 80`
- Can change port at runtime without rebuilding
- Supports `.env` file for configuration

## Understanding Arguments and Environment Variables

### Two Types of Configuration

Docker supports two types of dynamic configuration:

| Feature | Build Arguments (ARG) | Environment Variables (ENV) |
|---------|----------------------|----------------------------|
| **Available when** | Build time only | Build time AND runtime |
| **Set in Dockerfile** | `ARG name=default` | `ENV name=default` |
| **Override with** | `--build-arg` | `--env` or `-e` |
| **Available in app code** | ❌ No | ✅ Yes |
| **Use case** | Image build configuration | Runtime application configuration |

### Build Arguments (ARG)

```dockerfile
ARG NODE_VERSION=18
FROM node:${NODE_VERSION}
```

```bash
docker build --build-arg NODE_VERSION=20 -t myapp .
```

**Characteristics:**
- Only available during `docker build`
- Not available in running container
- Not accessible in application code
- Used for image build customization

### Environment Variables (ENV)

```dockerfile
ENV PORT=80
CMD node server.js
```

```bash
docker run --env PORT=8000 myapp
```

**Characteristics:**
- Available during build AND runtime
- Accessible in running container
- Available in application code
- Used for application configuration

**This lab focuses on ENV (environment variables).**

## Understanding Environment Variables

### What Are Environment Variables?

Environment variables are key-value pairs available globally to processes:

```bash
# In Linux/Mac
export PORT=8000
echo $PORT  # Outputs: 8000

# In application
# Node.js: process.env.PORT
# Python: os.environ['PORT']
# Java: System.getenv("PORT")
```

### Why Use Environment Variables?

**Flexibility:**
- Run same image in different configurations (dev/staging/prod)
- Change behavior without rebuilding images
- Support different environments with one image

**Security:**
- Don't hardcode secrets in source code or images
- Inject sensitive data at runtime
- Different secrets per environment

**Best Practices:**
- 12-Factor App methodology recommendation
- Cloud-native application pattern
- Container orchestration standard (Kubernetes, Docker Swarm)

**Common use cases:**
- Port numbers
- Database connection strings
- API keys and tokens
- Feature flags
- Environment names (dev/staging/prod)

## Lab Instructions

### Step 1: Setup - Copy Demo 03 Files

```bash
# Create project structure
mkdir -p 08-environment-variables/src
cd 08-environment-variables/src

# Copy all files from demo 03
cp -r ../../03-data-volume-feedback-app/src/* .
```

Refer to [03-data-volume-feedback-app](../03-data-volume-feedback-app/README.md) for complete file contents.

### Step 2: Update Application Code to Use Environment Variables

**2.1 Open `server.js` in your editor**

**2.2 Update the port configuration:**

**Before:**
```javascript
// ... rest of code ...

app.listen(80);
```

**After:**
```javascript
// ... rest of code ...

app.listen(process.env.PORT);
```

**What changed:**
- `80` → `process.env.PORT`
- Port is now read from environment variable
- `process.env` is a Node.js global object containing all environment variables

**2.3 Save the file**

### Step 3: Update Dockerfile - Declare Environment Variable

**3.1 Open `Dockerfile` in your editor**

**3.2 Add ENV instruction:**

**Before:**
```dockerfile
FROM node:25
WORKDIR /app
COPY package.json .
RUN npm install
COPY . .
EXPOSE 80
CMD ["node","server.js"]
```

**After:**
```dockerfile
FROM node:25
WORKDIR /app
COPY package.json .
RUN npm install
COPY . .
ENV PORT 80
EXPOSE $PORT
CMD ["node","server.js"]
```

**What changed:**
1. Added `ENV PORT 80` - Declares environment variable with default value
2. Changed `EXPOSE 80` → `EXPOSE $PORT` - Uses environment variable

**ENV syntax:**
```dockerfile
ENV KEY value          # Single variable
ENV KEY=value          # Alternative syntax
ENV KEY1=val1 KEY2=val2  # Multiple variables
```

**Using variables in Dockerfile:**
- Prefix with `$` to reference: `$PORT` or `${PORT}`
- Available in all subsequent instructions
- Can be overridden at runtime

### Step 4: Build Image with Environment Variable

```bash
docker build -t feedback-app:env .
```

**What happens during build:**
1. `ENV PORT 80` sets default PORT=80
2. `EXPOSE $PORT` expands to `EXPOSE 80`
3. Environment variable baked into image metadata
4. Can be overridden when running container

### Step 5: Run with Default Environment Variable

**5.1 Run container with defaults:**

```bash
docker run -d -p 8080:80 --name feedback-default \
  -v feedback-data:/app/feedback \
  feedback-app:env
```

**Note:** Port 80 is used internally (the default we set with `ENV PORT 80`)

**5.2 Access the application:**
```
http://localhost:8080
```

✅ **Works!** Using default PORT=80

**5.3 Verify environment variable:**

```bash
docker exec feedback-default printenv PORT
```

**Output:**
```
80
```

**5.4 View all environment variables:**

```bash
docker exec feedback-default printenv
```

You'll see many variables including:
```
PORT=80
NODE_VERSION=25.0.0
HOSTNAME=abc123def456
PATH=/usr/local/sbin:/usr/local/bin:...
```

**5.5 Cleanup:**

```bash
docker stop feedback-default
docker rm feedback-default
```

### Step 6: Override Environment Variable at Runtime

**6.1 Run with custom port using `--env`:**

```bash
docker run -d -p 9090:8000 --name feedback-custom \
  --env PORT=8000 \
  -v feedback-data:/app/feedback \
  feedback-app:env
```

**Command breakdown:**
- `-p 9090:8000` - Map host port 9090 to container port 8000
- `--env PORT=8000` - Override PORT environment variable
- Container now listens on port 8000 internally

**6.2 Access the application:**
```
http://localhost:9090
```

✅ **Works!** Now using custom PORT=8000

**6.3 Verify new port:**

```bash
docker exec feedback-custom printenv PORT
```

**Output:**
```
8000
```

**6.4 Check container logs:**

```bash
docker logs feedback-custom
```

Should show application started successfully.

**6.5 Test another port without rebuilding:**

```bash
docker stop feedback-custom
docker rm feedback-custom

docker run -d -p 3000:3000 --name feedback-3000 \
  --env PORT=3000 \
  -v feedback-data:/app/feedback \
  feedback-app:env
```

**Access:**
```
http://localhost:3000
```

✅ **Still works!** Changed port without rebuilding image.

### Step 7: Use Short Flag Syntax

**7.1 `-e` is shorthand for `--env`:**

```bash
docker stop feedback-3000
docker rm feedback-3000

docker run -d -p 5000:5000 --name feedback-short \
  -e PORT=5000 \
  -v feedback-data:/app/feedback \
  feedback-app:env
```

**Both work identically:**
- `--env PORT=5000` ✅
- `-e PORT=5000` ✅

**7.2 Multiple environment variables:**

```bash
docker run -d -p 5000:5000 --name feedback-multi \
  -e PORT=5000 \
  -e NODE_ENV=production \
  -e LOG_LEVEL=debug \
  -v feedback-data:/app/feedback \
  feedback-app:env
```

**7.3 Verify multiple variables:**

```bash
docker exec feedback-multi printenv | grep -E 'PORT|NODE_ENV|LOG_LEVEL'
```

**Output:**
```
PORT=5000
NODE_ENV=production
LOG_LEVEL=debug
```

### Step 8: Use Environment File (.env)

**8.1 Create `.env` file in your `src` directory:**

```bash
# .env file
PORT=8000
NODE_ENV=production
LOG_LEVEL=info
APP_NAME=FeedbackApp
```

**Note:** File can be named anything, `.env` is just a convention.

**8.2 Run container with environment file:**

```bash
docker stop feedback-multi
docker rm feedback-multi

docker run -d -p 8000:8000 --name feedback-envfile \
  --env-file ./.env \
  -v feedback-data:/app/feedback \
  feedback-app:env
```

**Command breakdown:**
- `--env-file ./.env` - Load all variables from file
- `./` means current directory
- Must use relative or absolute path

**8.3 Verify variables loaded:**

```bash
docker exec feedback-envfile printenv | grep -E 'PORT|NODE_ENV|LOG_LEVEL|APP_NAME'
```

**Output:**
```
PORT=8000
NODE_ENV=production
LOG_LEVEL=info
APP_NAME=FeedbackApp
```

✅ **All variables from file are loaded!**

**8.4 Access the application:**
```
http://localhost:8000
```

**8.5 Test updating .env file:**

Edit `.env`:
```bash
PORT=7000
NODE_ENV=development
LOG_LEVEL=debug
APP_NAME=FeedbackApp-Dev
```

**Restart with new values:**
```bash
docker stop feedback-envfile
docker rm feedback-envfile

docker run -d -p 7000:7000 --name feedback-envfile \
  --env-file ./.env \
  -v feedback-data:/app/feedback \
  feedback-app:env
```

**Access:**
```
http://localhost:7000
```

✅ **New port without code changes!**

### Step 9: Combining Dockerfile ENV with Runtime Override

**Understanding precedence:**

```
Priority (highest to lowest):
1. --env flag in docker run
2. --env-file in docker run
3. ENV in Dockerfile (default)
```

**9.1 Test precedence:**

Create `.env` with:
```
PORT=6000
```

Run with additional `--env`:
```bash
docker run -d -p 9999:9999 --name feedback-precedence \
  --env-file ./.env \
  --env PORT=9999 \
  -v feedback-data:/app/feedback \
  feedback-app:env
```

**9.2 Check which PORT wins:**

```bash
docker exec feedback-precedence printenv PORT
```

**Output:**
```
9999
```

✅ **`--env` flag wins!** It overrides both `.env` file and Dockerfile.

**Access:**
```
http://localhost:9999
```

### Step 10: Cleanup

```bash
# Stop and remove all containers
docker stop feedback-envfile feedback-precedence feedback-env
docker rm feedback-envfile feedback-precedence feedback-env

# Remove volumes
docker volume rm feedback-data

# Remove images
docker rmi feedback-app:env feedback-app:env-v2
```

## Common Commands Reference

| Command | Description |
|---------|-------------|
| `docker run -e KEY=value` | Set single environment variable |
| `docker run --env KEY=value` | Same as `-e` (long form) |
| `docker run --env-file .env` | Load variables from file |
| `docker exec <c> printenv` | View all environment variables |
| `docker exec <c> printenv KEY` | View specific variable |
| `docker inspect <c> -f '{{.Config.Env}}'` | Inspect container environment |

## Troubleshooting

**Environment variable not available in app:**
```bash
# Check if variable is set in container
docker exec mycontainer printenv MY_VAR

# If not set, ensure you used --env or --env-file
docker run -e MY_VAR=value ...
```

**`.env` file not found:**
```bash
# Ensure path is correct (relative or absolute)
docker run --env-file ./config/.env ...  # Relative
docker run --env-file /home/user/.env ... # Absolute

# Check file exists
ls -la .env
```

**Variable has wrong value:**
```bash
# Check precedence - command line overrides file
docker run --env-file .env -e PORT=9999 ...  # PORT=9999 wins
```

## What You Learned

In this lab, you:
- ✅ Understood build arguments (ARG) vs environment variables (ENV)
- ✅ Accessed environment variables in Node.js with `process.env`
- ✅ Declared environment variables in Dockerfile with default values
- ✅ Used environment variables in Dockerfile instructions ($VAR syntax)
- ✅ Overrode environment variables at runtime with `--env` flag
- ✅ Managed multiple variables using `.env` files
- ✅ Understood precedence rules (command > file > Dockerfile)
- ✅ Created flexible, configurable containers for different environments

**Key Takeaway:** Environment variables enable you to run the same Docker image in different configurations without rebuilding, following the "build once, run anywhere" principle. This is essential for modern DevOps and cloud-native applications!