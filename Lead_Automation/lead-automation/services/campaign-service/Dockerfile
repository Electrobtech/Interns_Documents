FROM node:20-alpine
WORKDIR /app
COPY shared ./shared
RUN cd /app/shared && npm install --omit=dev
COPY services/campaign-service ./services/campaign-service
WORKDIR /app/services/campaign-service
RUN npm install --omit=dev
CMD ["npm", "start"]
