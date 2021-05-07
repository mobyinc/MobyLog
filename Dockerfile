FROM node:14

ENV PORT 80

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install

RUN npm install pm2 -g

COPY . .

RUN npm run build

CMD ["pm2-runtime", "ecosystem.config.js"]
