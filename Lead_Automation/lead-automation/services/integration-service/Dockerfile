FROM node:20-alpine
WORKDIR /app
COPY shared ./shared
RUN cd /app/shared && npm install --omit=dev
COPY services/integration-service ./services/integration-service
WORKDIR /app/services/integration-service
RUN npm install --omit=dev
CMD ["npm", "start"]
