

# Learn Dockerfile ARG vs ENV, CMD, RUN, WORKDIR Instructions Practically

---

## Introduction

In this guide, you will:

1. Learn the differences between `ARG` and `ENV` instructions in Dockerfiles.
2. Learn how to use `CMD`, `RUN`, and `WORKDIR` instructions.
3. Create a simple Python Flask application.
4. Build Docker images using `ARG` and `ENV` instructions to manage build-time and runtime variables.



### Build Docker Image with Default ARG Value

```bash
# Change to the directory containing your Dockerfile
cd Dockerfiles

# Build Docker Image using default ENVIRONMENT (dev)
docker build -t demo9-arg-vs-env:v1 .

# Run Docker Container
docker run --name my-arg-env-demo1-dev -p 8080:80 -d demo9-arg-vs-env:v1

# List Docker Containers
docker ps

# Print environment variables from Container
docker exec -it my-arg-env-demo1-dev env | grep APP_ENVIRONMENT

# Expected Output:
# APP_ENVIRONMENT=dev

# Access the application in your browser
http://localhost:8080
```

**Expected Output:**

- The **Dev** HTML page should be displayed, indicating that the `APP_ENVIRONMENT` is set to `dev`.

### Run Docker Container and Override ENV Variable

```bash
# Run Docker Container and override APP_ENVIRONMENT to 'qa'
docker run --name my-arg-env-demo2-qa -p 8081:80 -e APP_ENVIRONMENT=qa -d demo9-arg-vs-env:v1

# List Docker Containers
docker ps

# Print environment variables from Container
docker exec -it my-arg-env-demo2-qa env | grep APP_ENVIRONMENT

# Expected Output:
# APP_ENVIRONMENT=qa

# Access the application in your browser
http://localhost:8081
```

**Expected Output:**

- The **QA** HTML page should be displayed, indicating that the `APP_ENVIRONMENT` is overridden to `qa` at runtime.

---

## Step 4: Verify WORKDIR and CMD Instructions

**Verify WORKDIR:**

```bash
# List files in the working directory inside the container
docker exec -it my-arg-env-demo1-dev ls /app

# Expected Output:
# app.py
# requirements.txt
# templates
```

- The files `app.py`, `requirements.txt`, and the `templates` directory should be present in the `/app` directory inside the container, confirming that the `WORKDIR` instruction is working as intended.

**Verify CMD Instruction:**

```bash
# Inspect the Docker image to verify CMD instruction
docker image inspect demo9-arg-vs-env:v1 --format='{{.Config.Cmd}}'

# Expected Output:
# [python app.py]
```

- This confirms that the `CMD` instruction is set to start the Flask application using `python app.py`.

---

## Step 5: Setting Default Environment to QA Without Changing Dockerfile

**Question:** How do you ensure the default environment is `qa` when building the Docker image without changing the Dockerfile?

**Answer:**

You can override the `ENVIRONMENT` build-time argument during the image build process using the `--build-arg` flag. This allows you to set the default `APP_ENVIRONMENT` to `qa` in the image without modifying the Dockerfile.

```bash
# Build Docker Image with ENVIRONMENT set to 'qa'
docker build --build-arg ENVIRONMENT=qa -t demo9-arg-vs-env:v1-qa .

# Run Docker Container without specifying the environment variable
docker run --name my-arg-env-demo3-qa -p 8082:80 -d demo9-arg-vs-env:v1-qa

# List Docker Containers
docker ps

# Print environment variables from Container
docker exec -it my-arg-env-demo3-qa env | grep APP_ENVIRONMENT

# Expected Output:
# APP_ENVIRONMENT=qa

# Access the application in your browser
http://localhost:8082
```

