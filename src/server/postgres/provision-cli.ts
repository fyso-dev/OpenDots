import { provisionPostgresSchema } from './provision.js';
import { resolvePostgresSchemaConfig } from './schema.js';

const config = resolvePostgresSchemaConfig();
if (!config) {
  throw new Error(
    'DATABASE_URL is required to provision the PostgreSQL schema.',
  );
}

await provisionPostgresSchema(config);
console.log(`OpenDots PostgreSQL schema ready: ${config.schema}`);
