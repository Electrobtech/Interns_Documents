FROM node:20-alpine
#ENV NODE_OPTIONS="--tls-cipher-list=TLS_CHACHA20_POLY1305_SHA256"
WORKDIR /app
COPY shared ./shared
RUN cd /app/shared && npm install --omit=dev
COPY services/auth-service ./services/auth-service
WORKDIR /app/services/auth-service
RUN npm install --omit=dev
#ENV NODE_OPTIONS="--tls-cipher-list=TLS_CHACHA20_POLY1305_SHA256"
CMD ["npm", "start"]
