FROM node:25
WORKDIR /app
COPY package.json .
RUN npm install
COPY . .
ENV PORT 80
EXPOSE $PORT
CMD ["node","server.js"]