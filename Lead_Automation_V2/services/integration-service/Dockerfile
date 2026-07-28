FROM node:20-alpine
#ENV NODE_OPTIONS="--tls-cipher-list=TLS_CHACHA20_POLY1305_SHA256"
WORKDIR /app
COPY shared ./shared
COPY services/integration-service ./services/integration-service
WORKDIR /app/shared
RUN npm install --omit=dev
WORKDIR /app/services/integration-service
RUN npm install --omit=dev
CMD ["npm", "start"]

