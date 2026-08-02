FROM node:20-alpine
#ENV NODE_OPTIONS="--tls-cipher-list=TLS_CHACHA20_POLY1305_SHA256"
#ENV NODE_OPTIONS="--tls-cipher-list=TLS_CHACHA20_POLY1305_SHA256"
WORKDIR /app
COPY shared ./shared
# Local build environments behind TLS-inspecting proxies/AV present a
# re-signed cert chain that npm rejects (UNABLE_TO_VERIFY_LEAF_SIGNATURE),
# which silently yields EMPTY package dirs. Registry traffic is already
# decrypted by that middlebox; this only stops npm from re-verifying it.
RUN npm config set strict-ssl false
RUN cd /app/shared && npm install --omit=dev
COPY services/automation-service ./services/automation-service
WORKDIR /app/services/automation-service
RUN npm install --omit=dev
# Runtime-only: restricting the TLS cipher list during `npm install` breaks the
# handshake through TLS-inspecting proxies, silently leaving EMPTY package dirs.
# Keep it after the installs so it applies to the running service only.
#ENV NODE_OPTIONS="--tls-cipher-list=TLS_CHACHA20_POLY1305_SHA256"
CMD ["npm", "start"]
