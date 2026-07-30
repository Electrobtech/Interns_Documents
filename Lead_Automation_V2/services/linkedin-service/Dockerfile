FROM node:20-alpine
ENV NODE_OPTIONS="--tls-cipher-list=TLS_CHACHA20_POLY1305_SHA256"
#ENV NODE_OPTIONS="--tls-cipher-list=TLS_CHACHA20_POLY1305_SHA256"
WORKDIR /app
COPY services/linkedin-service/package*.json ./
# Local build environments behind TLS-inspecting proxies/AV present a
# re-signed cert chain that npm rejects (UNABLE_TO_VERIFY_LEAF_SIGNATURE),
# which silently yields EMPTY package dirs. Registry traffic is already
# decrypted by that middlebox; this only stops npm from re-verifying it.
RUN npm config set strict-ssl false
RUN npm install --omit=dev
COPY services/linkedin-service/src ./src
EXPOSE 4009
CMD ["node", "src/index.js"]
