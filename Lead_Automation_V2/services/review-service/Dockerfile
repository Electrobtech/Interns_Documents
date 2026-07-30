FROM node:20-alpine
ENV NODE_OPTIONS="--tls-cipher-list=TLS_CHACHA20_POLY1305_SHA256"
#ENV NODE_OPTIONS="--tls-cipher-list=TLS_CHACHA20_POLY1305_SHA256"
WORKDIR /app
COPY shared ./shared
RUN cd /app/shared && npm install --omit=dev
COPY services/review-service ./services/review-service
WORKDIR /app/services/review-service
RUN npm install --omit=dev
CMD ["npm", "start"]
