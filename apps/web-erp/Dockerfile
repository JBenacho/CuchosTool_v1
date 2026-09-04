# Imagen del sitio ERP (contexto de build: raiz del monorepo).
# Construye el workspace completo para que npm enlace el paquete local de tokens.
FROM node:24-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY paquetes/tokens-diseno/package.json paquetes/tokens-diseno/package.json
COPY apps/api/package.json apps/api/package.json
COPY apps/web-ecommerce/package.json apps/web-ecommerce/package.json
COPY apps/web-erp/package.json apps/web-erp/package.json
RUN npm install --no-audit --no-fund

COPY paquetes/tokens-diseno/estilos paquetes/tokens-diseno/estilos
COPY apps/web-erp apps/web-erp
RUN npm run build -w @cuchostool/web-erp

FROM nginx:1.27-alpine
COPY --from=build /app/apps/web-erp/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
