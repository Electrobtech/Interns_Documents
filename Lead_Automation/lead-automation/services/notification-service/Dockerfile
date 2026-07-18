FROM node:20-alpine
WORKDIR /app
COPY shared ./shared
RUN cd /app/shared && npm install --omit=dev
COPY services/notification-service ./services/notification-service
WORKDIR /app/services/notification-service
RUN npm install --omit=dev
CMD ["npm", "start"]
