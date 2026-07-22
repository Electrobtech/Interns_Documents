FROM node:20-alpine
WORKDIR /app
COPY shared ./shared
RUN cd /app/shared && npm install --omit=dev
COPY services/review-service ./services/review-service
WORKDIR /app/services/review-service
RUN npm install --omit=dev
CMD ["npm", "start"]
