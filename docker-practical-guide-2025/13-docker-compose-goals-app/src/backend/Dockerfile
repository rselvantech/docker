FROM node:25

WORKDIR /app

COPY package.json .

RUN npm install

COPY . .

# Environment variables with defaults
ENV MONGODB_USERNAME=root
ENV MONGODB_PASSWORD=secret

EXPOSE 80

CMD ["npm", "start"]