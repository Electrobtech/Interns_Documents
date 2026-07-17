FROM node:20-alpine
WORKDIR /app
COPY shared ./shared
COPY services/integration-service ./services/integration-service
WORKDIR /app/services/integration-service
RUN npm install --omit=dev
CMD ["npm", "start"]
