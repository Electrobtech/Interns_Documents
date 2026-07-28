FROM node:20-alpine
#ENV NODE_OPTIONS="--tls-cipher-list=TLS_CHACHA20_POLY1305_SHA256"
WORKDIR /app
COPY shared ./shared
RUN cd /app/shared && npm install --omit=dev
COPY services/inbox-service ./services/inbox-service
WORKDIR /app/services/inbox-service
RUN npm install --omit=dev
CMD ["npm", "start"]
