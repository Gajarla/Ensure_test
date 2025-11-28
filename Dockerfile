FROM node
WORKDIR /home/node/app
#RUN mkdir -p /home/node/app/node_modules && chown node /home/node/app/node_modules
COPY package*.json ./
COPY yarn.lock .
RUN yarn install && chown -R node:node ./node_modules
USER node
COPY --chown=node:node . .
EXPOSE 3000
ENV NODE_OPTIONS=--openssl-legacy-provider
CMD ["npm", "start"]
