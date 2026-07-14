FROM node:20-alpine
WORKDIR /app
COPY shared ./shared
COPY services/contact-service ./services/contact-service
WORKDIR /app/services/contact-service
RUN npm install --omit=dev
CMD ["npm", "start"]
