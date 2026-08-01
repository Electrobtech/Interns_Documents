FROM node:20-alpine
WORKDIR /app
COPY shared ./shared
RUN cd /app/shared && npm install --omit=dev
COPY services/billing-service ./services/billing-service
WORKDIR /app/services/billing-service
RUN npm install --omit=dev
CMD ["npm", "start"]
