# Docker Container Basics Lab - Complete Guide

## Lab Overview

This hands-on lab introduces the fundamentals of Docker containerization by creating and running your first container. You'll learn how to build a Docker image, run a container, and manage its lifecycle through practical examples using a simple Node.js web application.

**What you'll do:**
- Create a Dockerfile for a Node.js application
- Build a Docker image from the Dockerfile
- Run a container and expose ports
- Stop and manage running containers

## Prerequisites

**Required Software:**
- Docker Desktop installed on your machine (Windows, Mac, or Linux)

## Lab Objectives

By the end of this lab, you will be able to:

1. ✅ Create a Dockerfile for containerizing applications
2. ✅ Build Docker images using the `docker build` command
3. ✅ Run containers and map ports to access applications
4. ✅ Stop and remove running containers

## Demo Application

### Node.js Web Server

The demo application is a simple Node.js web server that demonstrates basic containerization concepts:

**Features:**
- Express.js web server running on port 3000
- Dummy database connection simulation
- Basic HTTP endpoint for testing
- Uses modern Node.js async/await syntax
- Includes third-party dependencies from npm

**Application Structure:**
```
demo-1-gettting-started/src/
├── app.mjs             # Main application file
├── helpers.mjs         # supporting application file
├── package.json        # Node.js dependencies
└── Dockerfile          # Container configuration
```

This lightweight application is perfect for learning Docker basics without getting overwhelmed by complex business logic.

## Lab Instructions

### Step 1: Create the Application Files

**1.1 Create `demo-1-gettting-started/src/app.mjs`**
**1.2 Create `demo-1-gettting-started/src/helpers.mjs`**
**1.2 Create `demo-1-gettting-started/src/package.json`:**

### Step 2: Create the Dockerfile

Create a file named `Dockerfile` (no extension) in `demo-1-gettting-started/src` directory:

```dockerfile
# Use Node.js base image
FROM node:14

# Set working directory inside container
WORKDIR /app

# Copy package files
COPY package.json .

# Install dependencies
RUN npm install

# Copy application code
COPY . .

# Expose port 3000
EXPOSE 3000

# Start the application
CMD ["npm", "start"]
```

### Step 3: Build the Docker Image

Open your terminal in the `demo-1-gettting-started/src` directory and run:

```bash
docker build -t my-node-app .
```

**What happens:**
- Docker reads the Dockerfile
- Downloads the Node.js base image
- Installs npm dependencies
- Creates an image with your application
- Tags it as `my-node-app`

**Expected output:**
```
Successfully built [IMAGE_ID]
Successfully tagged my-node-app:latest
```

### Step 4: Run the Container

Start a container from your image:

```bash
docker run -d -p 3000:3000 --name my-container my-node-app
```

**Command breakdown:**
- `-d`: Run in detached mode (background)
- `-p 3000:3000`: Map port 3000 on host to port 3000 in container
- `--name my-container`: Give the container a friendly name
- `my-node-app`: The image to use

### Step 5: Test the Application

Open your browser and navigate to:
```
http://localhost:3000
```

You should see: `Hi there!`

### Step 6: View Running Containers

```bash
docker ps
```

This shows all running containers with their details.

### Step 7: Stop the Container

```bash
docker stop my-container
```

Wait a few seconds for the container to shut down gracefully.

**Verify it stopped:**
```bash
docker ps
```

The container should no longer appear in the list.

### Step 8: Remove the Container (Optional)

```bash
docker rm my-container
```

This permanently removes the stopped container.

## Troubleshooting

**Port already in use:**
```bash
# Use a different host port
docker run -d -p 8080:3000 --name my-container my-node-app
# Access at http://localhost:8080
```

## What You Learned

In this lab, you:
- ✅ Created a Dockerfile to define container configuration
- ✅ Built a Docker image containing your application and dependencies
- ✅ Ran a container and exposed ports for external access
- ✅ Managed container lifecycle (start, stop, remove)
- ✅ Understood the basic Docker development workflow
