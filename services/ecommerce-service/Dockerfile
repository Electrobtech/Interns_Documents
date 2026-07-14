FROM node:20-alpine
WORKDIR /app
COPY shared ./shared
COPY services/ecommerce-service ./services/ecommerce-service
WORKDIR /app/services/ecommerce-service
RUN npm install --omit=dev
CMD ["npm", "start"]
