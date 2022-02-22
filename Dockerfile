FROM node:lts-alpine3.14

WORKDIR /app

RUN apk add ffmpeg

COPY package.json .

RUN npm i

COPY . .

ENV PORT=3002

EXPOSE 3002

CMD [ "npm", "start" ]