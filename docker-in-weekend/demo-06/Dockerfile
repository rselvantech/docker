FROM nginx:alpine-slim

# OCI Labels
LABEL org.opencontainers.image.authors="rselvan"
LABEL org.opencontainers.image.title="Using ADD Instruction to Fetch Files using URL"
LABEL org.opencontainers.image.description="A Dockerfile demo illustrating the ADD instruction, which demonstrates how to download and add content from a GitHub Releases URL to the container."
LABEL org.opencontainers.image.version="1.0"

ADD https://github.com/rselvan-tech/docker-add-fetch-url-demo.git#main:docs /usr/share/nginx/html


