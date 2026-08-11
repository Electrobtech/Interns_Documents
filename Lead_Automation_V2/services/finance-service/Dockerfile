FROM node:20-alpine
WORKDIR /app
COPY shared ./shared
RUN cd /app/shared && npm install --omit=dev
COPY services/finance-service ./services/finance-service
WORKDIR /app/services/finance-service
RUN npm install --omit=dev
CMD ["npm", "start"]
