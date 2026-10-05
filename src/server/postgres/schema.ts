/**
 * PostgreSQL schema contract for OpenDots.
 *
 * A process is bound to one schema. A trusted deployment layer derives that
 * schema from the authorized tenant and injects it server-side, which makes a
 * connection pool unable to accidentally read another tenant's resources.
 */

const POSTGRES_IDENTIFIER = /^[a-z_][a-z0-9_]{0,62}$/;

export interface PostgresSchemaConfig {
  connectionString: string;
  schema: string;
}

export function assertPostgresSchema(schema: string): string {
  if (!POSTGRES_IDENTIFIER.test(schema) || schema === 'public') {
    throw new Error(
      'OPENDOTS_DB_SCHEMA must be a lowercase PostgreSQL identifier (letters, numbers, and underscores only).',
    );
  }
  return schema;
}

export function resolvePostgresSchemaConfig(
  environment: NodeJS.ProcessEnv = process.env,
): PostgresSchemaConfig | null {
  const connectionString = environment.DATABASE_URL?.trim();
  if (!connectionString) return null;
  return {
    connectionString,
    schema: assertPostgresSchema(environment.OPENDOTS_DB_SCHEMA ?? 'opendots'),
  };
}

/** Identifiers cannot be SQL parameters; validate before quoting them. */
export function quoteIdentifier(identifier: string): string {
  return `"${assertPostgresSchema(identifier)}"`;
}

export function qualifiedTable(schema: string, table: string): string {
  return `${quoteIdentifier(schema)}.${quoteIdentifier(table)}`;
}

/**
 * Initial durable state for OpenDots. Timestamps remain epoch milliseconds to
 * preserve the existing API contract while the SQLite stores are migrated.
 */
export function postgresProvisionStatements(schema: string): string[] {
  const s = quoteIdentifier(schema);
  const table = (name: string) => qualifiedTable(schema, name);
  return [
    `CREATE SCHEMA IF NOT EXISTS ${s}`,
    `CREATE TABLE IF NOT EXISTS ${table('settings')} (id SMALLINT PRIMARY KEY CHECK (id = 1), value JSONB NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS ${table('tasks')} (id UUID PRIMARY KEY, prompt TEXT NOT NULL, status TEXT NOT NULL, interval_seconds INTEGER, next_run_at BIGINT, created_at BIGINT NOT NULL, updated_at BIGINT NOT NULL, error TEXT, lease UUID, lease_until BIGINT)`,
    `CREATE TABLE IF NOT EXISTS ${table('runs')} (id UUID PRIMARY KEY, task_id UUID NOT NULL, status TEXT NOT NULL, started_at BIGINT NOT NULL, finished_at BIGINT, result JSONB, error TEXT)`,
    `CREATE TABLE IF NOT EXISTS ${table('events')} (id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY, task_id UUID NOT NULL, run_id UUID, text TEXT NOT NULL, created_at BIGINT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS ${table('memories')} (id UUID PRIMARY KEY, text TEXT NOT NULL, created_at BIGINT NOT NULL)`,
    `CREATE INDEX IF NOT EXISTS ${quoteIdentifier('tasks_due')} ON ${table('tasks')} (status, next_run_at)`,
    `CREATE INDEX IF NOT EXISTS ${quoteIdentifier('runs_task')} ON ${table('runs')} (task_id, started_at)`,
    `CREATE INDEX IF NOT EXISTS ${quoteIdentifier('events_task')} ON ${table('events')} (task_id, id)`,
    `CREATE TABLE IF NOT EXISTS ${table('spaces')} (id UUID PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL, created_at BIGINT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS ${table('dots')} (id UUID PRIMARY KEY, space_id UUID NOT NULL, name TEXT NOT NULL, instructions TEXT NOT NULL, research_allowed BOOLEAN NOT NULL, memory_allowed BOOLEAN NOT NULL, learning_container_id TEXT, skill_delivery_enabled BOOLEAN NOT NULL DEFAULT FALSE, created_at BIGINT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS ${table('dot_spaces')} (dot_id UUID NOT NULL, space_id UUID NOT NULL, PRIMARY KEY (dot_id, space_id))`,
    `CREATE TABLE IF NOT EXISTS ${table('thread_bindings')} (id TEXT PRIMARY KEY, dot_id UUID NOT NULL, owner_id TEXT NOT NULL, title TEXT NOT NULL, learning_container_id TEXT, created_at BIGINT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS ${table('task_threads')} (task_id UUID PRIMARY KEY, thread_id TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS ${table('calls')} (id UUID PRIMARY KEY, thread_id TEXT NOT NULL, started_at BIGINT NOT NULL, ended_at BIGINT, status TEXT NOT NULL, transcript TEXT NOT NULL, error TEXT, anchor_message_id TEXT)`,
    `CREATE TABLE IF NOT EXISTS ${table('captures')} (thread_id TEXT PRIMARY KEY, value JSONB NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS ${table('pages')} (id UUID PRIMARY KEY, space_id UUID NOT NULL, parent_id UUID, title TEXT NOT NULL, content TEXT NOT NULL, revision INTEGER NOT NULL, created_at BIGINT NOT NULL, updated_at BIGINT NOT NULL, source_thread_id TEXT)`,
    `CREATE TABLE IF NOT EXISTS ${table('page_reviews')} (thread_id TEXT NOT NULL, tool_call_id TEXT NOT NULL, page_id UUID NOT NULL, space_id UUID NOT NULL, PRIMARY KEY (thread_id, tool_call_id))`,
    `CREATE TABLE IF NOT EXISTS ${table('page_threads')} (page_id UUID NOT NULL, dot_id UUID NOT NULL, thread_id TEXT NOT NULL UNIQUE, ready BOOLEAN NOT NULL DEFAULT FALSE, lease_until BIGINT NOT NULL DEFAULT 0, PRIMARY KEY (page_id, dot_id))`,
  ];
}
