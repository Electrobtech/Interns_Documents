FROM node:20-alpine
WORKDIR /app
COPY shared ./shared
COPY services/integration-service ./services/integration-service
WORKDIR /app/shared
RUN npm install --omit=dev
WORKDIR /app/services/integration-service
RUN npm install --omit=dev
ENV NODE_OPTIONS="--tls-cipher-list=TLS_CHACHA20_POLY1305_SHA256"
CMD ["npm", "start"]

