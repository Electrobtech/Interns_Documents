FROM node:20-alpine
WORKDIR /app
COPY shared ./shared
RUN cd /app/shared && npm install --omit=dev
COPY services/team-service ./services/team-service
WORKDIR /app/services/team-service
RUN npm install --omit=dev
CMD ["npm", "start"]
