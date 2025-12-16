In this demo, you will:

Create tar file : tar -czvf files.tar.gz -C App-Files .

Create an Nginx Dockerfile using nginx:alpine-slim as the base image.
Add ADD instructions to copy a archieve file
Build the Docker image.
Run a container using image and verify

########################################################
Using ADD with Archive Files:

The ADD command has a special behavior: if you copy an archive file (e.g., .tar, .tar.gz, .zip), Docker will automatically extract the contents of the archive into the destination directory.

Using COPY with Archive Files:

The COPY command, on the other hand, does not extract archive files. It simply copies the file as-is to the specified destination.