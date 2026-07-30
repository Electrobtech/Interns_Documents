FROM node:20-alpine
WORKDIR /app
COPY shared ./shared
COPY services/calendar-service ./services/calendar-service
WORKDIR /app/shared
RUN npm install --omit=dev
WORKDIR /app/services/calendar-service
RUN npm install --omit=dev
ENV NODE_OPTIONS="--tls-cipher-list=TLS_CHACHA20_POLY1305_SHA256"
CMD ["npm", "start"]
