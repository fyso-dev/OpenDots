import postgres from 'postgres';
import {
  type PostgresSchemaConfig,
  postgresProvisionStatements,
} from './schema.js';

/** Idempotently provisions the OpenDots tables in one pre-validated schema. */
export async function provisionPostgresSchema(
  config: PostgresSchemaConfig,
): Promise<void> {
  const sql = postgres(config.connectionString, { max: 1 });
  try {
    for (const statement of postgresProvisionStatements(config.schema)) {
      await sql.unsafe(statement);
    }
  } finally {
    await sql.end({ timeout: 5 });
  }
}
