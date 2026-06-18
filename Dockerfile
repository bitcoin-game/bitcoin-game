FROM node:22-alpine
WORKDIR /app

# Copy workspace manifests before source to cache the install layer
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/miniapp/package.json apps/miniapp/
COPY packages/shared/package.json packages/shared/

RUN npm ci

COPY . .

# Build frontend → apps/miniapp/dist
RUN npm run build --workspace=apps/miniapp

# Generate Prisma client from the schema
RUN npm run prisma:generate

EXPOSE 3000

# prisma migrate deploy runs from apps/api/ (finds prisma/schema.prisma automatically)
CMD ["npm", "run", "start:prod", "--workspace=apps/api"]
