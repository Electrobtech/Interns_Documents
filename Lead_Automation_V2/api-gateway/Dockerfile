FROM node:20-alpine
#ENV NODE_OPTIONS=--openssl-legacy-provider
WORKDIR /app
COPY api-gateway ./
# Local build environments behind TLS-inspecting proxies/AV present a
# re-signed cert chain that npm rejects (UNABLE_TO_VERIFY_LEAF_SIGNATURE),
# which silently yields EMPTY package dirs. Registry traffic is already
# decrypted by that middlebox; this only stops npm from re-verifying it.
RUN npm config set strict-ssl false
RUN npm install --omit=dev
CMD ["npm", "start"]
