In this demo, you will:

Create an Nginx Dockerfile using nginx:alpine-slim as the base image.
Add labels to your Docker image.
Use the ADD instruction in the Dockerfile to fetch content from a URL (GitHub URL).
Build the Docker image.
Run a container using image and verify

########################################################
Git URL Syntax for ADD

https://github.com/user/repo.git#<ref>:<subdirectory>

Where:
#<ref> - Branch name, tag, or commit hash (e.g., #main, #v1.0.0, #abc123)
:<subdirectory> - Optional path to a specific directory in the repo

Important Requirements: This feature requires BuildKit to be enabled. It should be enabled by default in recent Docker versions