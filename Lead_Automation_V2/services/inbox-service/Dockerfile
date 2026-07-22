FROM node:20-alpine
WORKDIR /app
COPY shared ./shared
RUN cd /app/shared && npm install --omit=dev
COPY services/inbox-service ./services/inbox-service
WORKDIR /app/services/inbox-service
RUN npm install --omit=dev
CMD ["npm", "start"]
