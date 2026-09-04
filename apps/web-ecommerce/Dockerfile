# UI estatica construida y servida por nginx (produccion local/demo)
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json .
RUN npm install --no-audit --no-fund
COPY . .
RUN npm run build

FROM nginx:1.27-alpine AS runtime
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
