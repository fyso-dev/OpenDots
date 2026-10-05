import { describe, expect, it } from 'vitest';
import {
  assertPostgresSchema,
  postgresProvisionStatements,
  resolvePostgresSchemaConfig,
} from '../src/server/postgres/schema.js';

describe('PostgreSQL schema contract', () => {
  it('accepts an isolated tenant schema', () => {
    expect(assertPostgresSchema('opendots_tenant_acme_42')).toBe(
      'opendots_tenant_acme_42',
    );
  });

  it.each(['public', 'tenant-a', 'tenant;drop', 'a,b', 'Tenant'])(
    'rejects unsafe or noncanonical schema %s',
    (schema) => {
      expect(() => assertPostgresSchema(schema)).toThrow('OPENDOTS_DB_SCHEMA');
    },
  );

  it('uses one explicit schema for every provisioned table', () => {
    const statements = postgresProvisionStatements('opendots_tenant_acme');
    expect(statements).toHaveLength(19);
    expect(
      statements.every((statement) => !statement.includes('public.')),
    ).toBe(true);
    expect(
      statements.some((statement) =>
        statement.includes('"opendots_tenant_acme"."tasks"'),
      ),
    ).toBe(true);
  });

  it('keeps database credentials separate from the schema decision', () => {
    expect(
      resolvePostgresSchemaConfig({
        DATABASE_URL: 'postgresql://example',
        OPENDOTS_DB_SCHEMA: 'opendots_tenant_one',
      }),
    ).toEqual({
      connectionString: 'postgresql://example',
      schema: 'opendots_tenant_one',
    });
  });
});
