FROM node:20-alpine
#ENV NODE_OPTIONS="--tls-cipher-list=TLS_CHACHA20_POLY1305_SHA256"
WORKDIR /app
COPY shared ./shared
COPY services/email-service ./services/email-service
WORKDIR /app/shared
RUN npm install --omit=dev
WORKDIR /app/services/email-service
RUN npm install --omit=dev
CMD ["npm", "start"]
