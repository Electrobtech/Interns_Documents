FROM node:20-alpine
WORKDIR /app
COPY shared ./shared
COPY services/ai-service ./services/ai-service
WORKDIR /app/services/ai-service
RUN npm install --omit=dev
CMD ["npm", "start"]
