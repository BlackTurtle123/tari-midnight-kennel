FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG KENNEL_BASE_PATH=/tari/
ENV KENNEL_BASE_PATH=$KENNEL_BASE_PATH
RUN npm run build

FROM debian:bookworm-slim AS wallet
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl && rm -rf /var/lib/apt/lists/*
RUN curl -fL --retry 3 https://github.com/tari-project/tari-ootle/releases/download/v0.47.0/tari_ootle_walletd-0.47.0-9dabb2a-linux-x86_64 -o /tari_ootle_walletd \
 && echo '919579e691fa3ec4ddead30a40f96c67f1efa0a735ca77a17cc2dc53d611ba52  /tari_ootle_walletd' | sha256sum --check --strict \
 && chmod 755 /tari_ootle_walletd

FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates libdbus-1-3 libssl3 libstdc++6 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/server ./server
COPY --from=build /app/shared ./shared
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/deploy/entrypoint.mjs ./deploy/entrypoint.mjs
COPY --from=build /app/deploy/artifacts/midnight_kennel.wasm ./contract/target/wasm32-unknown-unknown/release/midnight_kennel.wasm
COPY --from=build /app/deploy/artifacts/arkimals_rebirth.wasm ./rebirth-contract/target/wasm32-unknown-unknown/release/arkimals_rebirth.wasm
COPY --from=build /app/deploy/artifacts/arkimals_staking.wasm ./staking-contract/target/wasm32-unknown-unknown/release/arkimals_staking.wasm
COPY --from=build /app/deploy/artifacts/arkimals_breeding.wasm ./breeding-contract/target/wasm32-unknown-unknown/release/arkimals_breeding.wasm
COPY --from=build /app/deploy/artifacts/arkimals_incubation_treasury.wasm ./treasury-contract/target/wasm32-unknown-unknown/release/arkimals_incubation_treasury.wasm
COPY --from=wallet /tari_ootle_walletd /usr/local/bin/tari_ootle_walletd
ARG VERSION=development
ENV NODE_OPTIONS=--experimental-wasm-modules NODE_ENV=production KENNEL_DATA_DIR=/data KENNEL_VERSION=$VERSION KENNEL_BIND_HOST=0.0.0.0 HOME=/data
USER 1001:1001
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 CMD node -e "fetch('http://127.0.0.1:8787/api/health').then(async r=>{if(!r.ok||!(await r.json()).walletReady)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "--import", "tsx", "deploy/entrypoint.mjs"]
