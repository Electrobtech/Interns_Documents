FROM node:20-alpine

WORKDIR /app

COPY shared ./shared
COPY services/auth-service ./services/auth-service

# Install shared dependencies
WORKDIR /app/shared
RUN npm install

# Install service dependencies
WORKDIR /app/services/auth-service
RUN npm install

CMD ["npm", "start"]