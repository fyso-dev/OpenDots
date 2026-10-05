# PostgreSQL schemas

This change adds a PostgreSQL persistence foundation. It is an incremental
migration: the current OpenDots runtime continues to use SQLite until its
synchronous stores are replaced by asynchronous PostgreSQL stores. Do not set
`DATABASE_URL` and assume the running application has switched storage;
provision the schema first and enable the runtime only in a later, tested
migration.

## Isolation model

One OpenDots process is bound to exactly one `OPENDOTS_DB_SCHEMA`. A trusted
deployment layer derives that value from the authenticated organization and
never accepts it from the browser. A recommended naming rule is:

```text
opendots_tenant_<normalized_tenant_slug>
```

For example, `opendots_tenant_acme_42`. Each organization receives a different
schema in the same PostgreSQL database. The provisioner validates identifiers;
it rejects `public`, quoted identifiers, schema lists, uppercase names and SQL
fragments. A database role should additionally be granted access only to its
assigned schema.

## Provisioning

```bash
DATABASE_URL='postgresql://…/opendots' \
OPENDOTS_DB_SCHEMA=opendots_tenant_acme \
npm run db:postgres:provision
```

The command is idempotent. It creates the OpenDots state tables and indexes in
the requested schema only. It does not create a schema from a tenant value sent
by a client and it does not expose a `search_path` control in HTTP requests.

## Migration boundary

The next fork change replaces `Store`, `WorkspaceStore`, `Pages` and the
computer store's SQLite calls with asynchronous repositories and PostgreSQL
transactions. The computer store is present only so the schema migration does
not silently lose existing OpenDots data. No runtime switch is enabled before
the task lease, page-review, optimistic-revision and restart-recovery tests run
against PostgreSQL.
