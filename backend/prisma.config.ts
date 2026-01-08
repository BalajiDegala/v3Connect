import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

// Prisma 7 configuration
// See: https://www.prisma.io/docs/orm/reference/prisma-config-reference

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
