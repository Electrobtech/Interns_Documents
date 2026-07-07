FROM node:20-alpine
WORKDIR /app
COPY shared ./shared
COPY services/analytics-service ./services/analytics-service
WORKDIR /app/services/analytics-service
RUN npm install --omit=dev
CMD ["npm", "start"]
