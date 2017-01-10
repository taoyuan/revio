FROM node:7.4

ADD . /proxy
RUN cd /proxy; npm install --production
EXPOSE 8080

