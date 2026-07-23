FROM node:20-alpine
WORKDIR /app
COPY shared ./shared
COPY services/email-service ./services/email-service
WORKDIR /app/shared
RUN npm install --omit=dev
WORKDIR /app/services/email-service
RUN npm install --omit=dev
CMD ["npm", "start"]
