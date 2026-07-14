FROM node:20-alpine
WORKDIR /app
COPY shared ./shared
COPY services/review-service ./services/review-service
WORKDIR /app/services/review-service
RUN npm install --omit=dev
CMD ["npm", "start"]
