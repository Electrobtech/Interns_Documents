FROM node:20-alpine
ENV NODE_OPTIONS="--tls-cipher-list=TLS_CHACHA20_POLY1305_SHA256"
WORKDIR /app
COPY services/linkedin-service/package*.json ./
RUN npm install --omit=dev
COPY services/linkedin-service/src ./src
EXPOSE 4009
CMD ["node", "src/index.js"]
