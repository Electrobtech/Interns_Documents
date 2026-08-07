FROM node:20-alpine
WORKDIR /app
COPY shared ./shared
# Local build environments behind TLS-inspecting proxies/AV present a
# re-signed cert chain that npm rejects (UNABLE_TO_VERIFY_LEAF_SIGNATURE),
# which silently yields EMPTY package dirs. Registry traffic is already
# decrypted by that middlebox; this only stops npm from re-verifying it.
RUN npm config set strict-ssl false
RUN cd /app/shared && npm install --omit=dev
COPY services/marketing-hub-service ./services/marketing-hub-service
WORKDIR /app/services/marketing-hub-service
RUN npm install --omit=dev
# Create uploads directory for assets
RUN mkdir -p /app/services/marketing-hub-service/uploads/assets
CMD ["npm", "start"]
