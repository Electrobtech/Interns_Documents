FROM node:20-alpine
ENV NODE_OPTIONS="--tls-cipher-list=TLS_CHACHA20_POLY1305_SHA256"
WORKDIR /app
COPY shared ./shared
RUN cd /app/shared && npm install --omit=dev
COPY services/campaign-service ./services/campaign-service
WORKDIR /app/services/campaign-service
RUN npm install --omit=dev
CMD ["npm", "start"]
