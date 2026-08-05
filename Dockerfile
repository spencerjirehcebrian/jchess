# jchess compiles to a directory of static files. There is no server in this
# project — only a page, and the two Stockfish binaries it loads. So the whole
# deployment is nginx handing those over with the right headers on them.

FROM node:26-alpine AS build
WORKDIR /app

# Dependencies first, so editing a source file does not re-resolve the tree.
#
# --ignore-scripts skips the postinstall that copies the Stockfish binaries out
# of node_modules. All four are committed under public/engine, so the copy would
# only overwrite them with themselves.
COPY package.json package-lock.json .npmrc ./
RUN npm ci --ignore-scripts

COPY . .
RUN npm run build

# vite-plugin-compression prepares .gz beside the js, css and html, but not
# beside wasm — and the two engine binaries are ~7MB each, by far the largest
# thing served. Compressing them here lets gzip_static hand over a prepared file
# instead of nginx gzipping 7MB on every cold request.
RUN find dist -name '*.wasm' -exec gzip -9 -k {} +

FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
