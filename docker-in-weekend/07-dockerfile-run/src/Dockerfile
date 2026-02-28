# Use nginx:alpine as base — alpine has apk package manager
FROM nginx:1.28-alpine

# OCI Labels
LABEL org.opencontainers.image.authors="RSelvanTech"
LABEL org.opencontainers.image.title="Demo: RUN - Optimized"
LABEL org.opencontainers.image.description="Nginx with headers-more module"

# ✅ Good practice — single RUN with chained commands = single layer
# apk add --no-cache avoids storing package index inside the image layer
RUN apk update && \
    apk add --no-cache nginx-mod-http-headers-more && \
    rm -rf /var/cache/apk/*

# ✅ Good order — stable config before frequently changing html
COPY nginx/nginx.conf /etc/nginx/nginx.conf
COPY html/ /usr/share/nginx/html/

EXPOSE 80
