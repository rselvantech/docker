# Dockerfile Basics - Custom Nginx Image Lab

## Lab Overview

This hands-on lab introduces Dockerfile fundamentals by creating a custom Nginx web server image. You'll learn how to write a basic Dockerfile, build custom images, tag them properly, and push them to Docker Hub for sharing. This lab covers the complete Docker workflow from creating a Dockerfile to publishing your image publicly.

**What you'll do:**
- Write your first Dockerfile with basic instructions
- Customize an official Nginx base image
- Build and run custom Docker images
- Create a Docker Hub account and authenticate
- Tag images following naming conventions
- Push images to Docker Hub registry
- Pull and verify published images

## Prerequisites

**Required Software:**
- Docker client and daemon installed and running
- Text editor or IDE


**Required Accounts:**
- Docker Hub account (free) - will be created in this lab

**Knowledge Requirements:**
- Basic Docker concepts (containers, images)
- Command line familiarity
- Basic HTML knowledge helpful

## Lab Objectives

By the end of this lab, you will be able to:

1. ✅ Understand Dockerfile syntax and basic instructions
2. ✅ Create custom Docker images using Dockerfile
3. ✅ Build images with `docker build` command
4. ✅ Run containers from custom images
5. ✅ Create and configure Docker Hub account
6. ✅ Tag images with proper naming conventions
7. ✅ Push images to Docker Hub registry
8. ✅ Pull and verify published images

## Demo Application

### Custom Nginx Web Server

The demo creates a customized Nginx web server with your own HTML content:

**Features:**
- Based on official Nginx image from Docker Hub
- Custom HTML page replacing default Nginx welcome page
- Publishable and shareable via Docker Hub

**Application Structure:**
```
03-dockerfile-nginx-custom/
└── src/
    ├── Dockerfile          # Image build instructions
    └── index.html          # Custom HTML content
```

**How it works:**
1. Starts with official `nginx` base image
2. Copies custom `index.html` to Nginx's web root
3. Inherits all Nginx functionality (port 80, configuration, etc.)
4. Results in a new custom image with your content

This simple example demonstrates the power of Docker's layered architecture and image reusability.

## Lab Instructions

### Step 1: Introduction to Dockerfiles and Instructions

A Dockerfile is a text file containing instructions to build a Docker image. Each instruction creates a new layer in the image.

**Common Dockerfile Instructions:**

| Instruction | Purpose | Example |
|-------------|---------|---------|
| `FROM` | Specifies base image | `FROM nginx` |
| `COPY` | Copies files from host to image | `COPY index.html /app/` |
| `RUN` | Executes commands during build | `RUN npm install` |
| `CMD` | Default command when container starts | `CMD ["nginx", "-g", "daemon off;"]` |
| `EXPOSE` | Documents which port to expose | `EXPOSE 80` |
| `WORKDIR` | Sets working directory | `WORKDIR /app` |
| `ENV` | Sets environment variables | `ENV NODE_ENV=production` |

**This Lab's Dockerfile:**
```dockerfile
FROM nginx
COPY index.html /usr/share/nginx/html
```

**Line by line explanation:**
- `FROM nginx`: Use official Nginx image as foundation
- `COPY index.html /usr/share/nginx/html`: Copy our HTML file to Nginx's default web root directory

That's it! Two simple instructions create a fully functional custom web server.

### Step 2: Create Docker Hub ID and Login

**2.1 Create Docker Hub Account:**

1. Visit [https://hub.docker.com](https://hub.docker.com)
2. Click "Sign Up"
3. Fill in the registration form:
   - Docker ID (username) - choose carefully, this will be in your image names
   - Email address
   - Password
4. Verify your email address
5. Complete the registration

**2.2 Login from Terminal:**

```bash
docker login
```

**Using info given in the CLI, login and authenticate using browser**
```
USING WEB-BASED LOGIN

i Info → To sign in with credentials on the command line, use 'docker login -u <username>'
         

Your one-time device confirmation code is: XXXX-YYYY
Press ENTER to open your browser or submit your device code here: https://login.docker.com/activate

Waiting for authentication in the browser…
```

**Expected output:**
```
Login Succeeded
```

### Step 3: Create Project Structure

```bash
mkdir -p 03-dockerfile-nginx-custom/src
cd 03-dockerfile-nginx-custom/src
```

### Step 4: Create Application Files

**4.1 Create `Dockerfile`:**

**4.2 Create `index.html`:**

### Step 5: Run Nginx Base Image and Verify

Before building our custom image, let's understand the base image:

**5.1 Pull and run official Nginx:**
```bash
docker run -d -p 8080:80 --name nginx-base nginx
```

**5.2 Access default Nginx page:**
```
http://localhost:8080
```

You'll see the default "Welcome to nginx!" page.

**5.3 Inspect the container:**
```bash
# View running container
docker ps

# Check Nginx version
docker exec nginx-base nginx -v

# See default HTML location
docker exec nginx-base ls -la /usr/share/nginx/html
```

**5.4 View default index.html:**
```bash
docker exec nginx-base cat /usr/share/nginx/html/index.html
```

This shows what we'll be replacing with our custom HTML.

**5.5 Stop and remove base container:**
```bash
docker stop nginx-base
docker rm nginx-base
```

### Step 6: Build Docker Image and Verify

**6.1 Build the custom image:**

From the `src` directory:
```bash
docker build -t my-custom-nginx .
```

**Command breakdown:**
- `docker build`: Build an image from a Dockerfile
- `-t my-custom-nginx`: Tag the image with a name
- `.`: Build context (current directory)

**Expected output:**
```
[+] Building 2.5s (7/7) FINISHED
 => [internal] load build definition from Dockerfile
 => => transferring dockerfile: 37B
 => [internal] load .dockerignore
 => [internal] load metadata for docker.io/library/nginx:latest
 => [1/2] FROM docker.io/library/nginx:latest
 => [internal] load build context
 => => transferring context: 250B
 => [2/2] COPY index.html /usr/share/nginx/html
 => exporting to image
 => => exporting layers
 => => writing image sha256:abc123...
 => => naming to docker.io/library/my-custom-nginx
```

**6.2 Verify the image:**
```bash
docker images | grep my-custom-nginx
```

You should see:
```
my-custom-nginx    latest    abc123def456    10 seconds ago    187MB
```

**6.3 Run container from custom image:**
```bash
docker run -d -p 8080:80 --name my-nginx my-custom-nginx
```

**6.4 Test your custom page:**
```
http://localhost:8080
```

You should see YOUR custom HTML content, not the default Nginx page! 🎉

**6.5 Verify it's your content:**
```bash
docker exec my-nginx cat /usr/share/nginx/html/index.html
```

Should show your custom HTML.

**6.6 Check logs:**
```bash
docker logs my-nginx
```

**6.7 Stop container (keep for next step):**
```bash
docker stop my-nginx
docker rm my-nginx
```

### Step 7: Tag and Push Docker Image

**7.1 Understanding Docker image naming:**

Format: `registry/username/repository:tag`

Examples:
- `docker.io/johndoe/my-nginx:latest`
- `docker.io/johndoe/my-nginx:v1.0`
- `johndoe/my-nginx:latest` (docker.io is default)

**7.2 Tag your image:**

Replace `your-dockerhub-username` with your actual Docker Hub username:

```bash
docker tag my-custom-nginx your-dockerhub-username/my-custom-nginx:latest
```

**Example:**
```bash
docker tag my-custom-nginx rselvantech/my-custom-nginx:latest
```

**7.3 Create additional version tag:**
```bash
docker tag my-custom-nginx your-dockerhub-username/my-custom-nginx:v1.0
```

**7.4 Verify tags:**
```bash
docker images | grep my-custom-nginx
```

You should see:
```
my-custom-nginx                          latest    abc123    ...
your-dockerhub-username/my-custom-nginx  latest    abc123    ...
your-dockerhub-username/my-custom-nginx  v1.0      abc123    ...
```

Notice they all have the same image ID - they're the same image with different names!

**7.5 Push to Docker Hub:**

```bash
docker push your-dockerhub-username/my-custom-nginx:latest
docker push your-dockerhub-username/my-custom-nginx:v1.0
```

**Expected output:**
```
The push refers to repository [docker.io/your-dockerhub-username/my-custom-nginx]
abc123: Pushed
def456: Layer already exists
latest: digest: sha256:xyz789... size: 1234
```

**7.6 Verify in Docker Hub:**

1. Go to [https://hub.docker.com](https://hub.docker.com)
2. Click "Repositories"
3. You should see `my-custom-nginx` listed
4. Click on it to view details
5. Check the "Tags" tab - both `latest` and `v1.0` should be there

### Step 8: Pull and Test Published Image

Now simulate downloading and using your published image on a "different machine":

**8.1 Remove local images:**
```bash
docker rmi my-custom-nginx
docker rmi your-dockerhub-username/my-custom-nginx:latest
docker rmi your-dockerhub-username/my-custom-nginx:v1.0
```

**8.2 Pull from Docker Hub:**
```bash
docker pull your-dockerhub-username/my-custom-nginx:latest
```

**8.3 Run the pulled image:**
```bash
docker run -d -p 8080:80 --name test-nginx your-dockerhub-username/my-custom-nginx:latest
```

**8.4 Verify it works:**
```
http://localhost:8080
```

Your custom HTML should display - proving the image was successfully published and can be used by anyone!

**8.5 Share your image:**

Anyone can now pull and run your image:
```bash
docker pull your-dockerhub-username/my-custom-nginx:latest
docker run -d -p 8080:80 your-dockerhub-username/my-custom-nginx
```

### Step 9: Cleanup

```bash
# Stop and remove containers
docker stop test-nginx
docker rm test-nginx

# Remove local images
docker rmi your-dockerhub-username/my-custom-nginx:latest
docker rmi your-dockerhub-username/my-custom-nginx:v1.0

# Optional: Remove from Docker Hub
# (Do this via Docker Hub web interface → Repository Settings → Delete)
```

## Understanding Docker Image Layers

When you built the custom image, Docker created layers:

```
Layer 1: nginx base image (from Docker Hub)
Layer 2: Your index.html (added by COPY instruction)
= Final custom image
```

**View layers:**
```bash
docker history your-dockerhub-username/my-custom-nginx:latest
```

**Benefits of layers:**
- **Caching**: Unchanged layers are reused
- **Efficiency**: Only new layers are pushed/pulled
- **Speed**: Faster builds and deployments

## Common Commands Reference

| Command | Description |
|---------|-------------|
| `docker build -t <name> .` | Build image from Dockerfile |
| `docker tag <source> <target>` | Create a new tag for an image |
| `docker push <image>` | Upload image to registry |
| `docker pull <image>` | Download image from registry |
| `docker login` | Authenticate to Docker Hub |
| `docker images` | List local images |
| `docker history <image>` | View image layers |
| `docker rmi <image>` | Remove local image |

## Key Concepts Explained

### Dockerfile
A text file with instructions to build a Docker image. Each instruction creates a layer.

### Base Image
The starting point for your custom image. You build on top of existing images rather than starting from scratch.

### Image Tags
Labels for image versions (e.g., `latest`, `v1.0`, `prod`). Same image can have multiple tags.

### Docker Registry
Storage and distribution system for Docker images. Docker Hub is the default public registry.

### Image Layers
Images are built in layers. Each Dockerfile instruction creates a new read-only layer.

## Troubleshooting

**Build fails with "unable to prepare context":**
```bash
# Ensure you're in the directory with Dockerfile
ls -la Dockerfile

# Check file permissions
chmod 644 Dockerfile index.html
```

**Cannot access http://localhost:8080:**
```bash
# Check if container is running
docker ps

# Check port mapping
docker port my-nginx

# Try different port
docker run -d -p 9090:80 --name my-nginx my-custom-nginx
```

**Push fails with "denied: requested access to the resource is denied":**
```bash
# Ensure you're logged in
docker login

# Verify image name includes your username
docker images | grep your-dockerhub-username

# Re-tag if necessary
docker tag my-custom-nginx your-dockerhub-username/my-custom-nginx:latest
```

**"unauthorized: authentication required":**
```bash
# Login again
docker logout
docker login
```

## What You Learned

In this lab, you:
- ✅ Wrote your first Dockerfile with FROM and COPY instructions
- ✅ Built a custom Docker image from a Dockerfile
- ✅ Understood Docker's layered image architecture
- ✅ Created a Docker Hub account and authenticated
- ✅ Tagged images following proper naming conventions
- ✅ Pushed custom images to Docker Hub public registry
- ✅ Pulled and verified published images
- ✅ Learned the complete Docker image lifecycle

