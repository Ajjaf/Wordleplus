# Database Migration Guide

## Creating Migrations

```bash
# 1. Edit schema.prisma
# 2. Create migration (always give it a descriptive name)
npm run prisma:migrate:dev -- --name describe_your_change

# 3. Test migration on a fresh DB
npm run prisma:migrate:reset   # WARNING: drops all data
npm run prisma:migrate:dev
```

## Deploying Migrations

```bash
# Production — always use migrate:deploy (never migrate:dev)
npm run prisma:migrate:deploy
```

`migrate:deploy` applies pending migrations without prompting or resetting.
`migrate:dev` is interactive, generates new migrations, and can reset — **never** use it in production.

## Rollback Procedure

If a migration fails in production:

1. **Don't panic** — Prisma wraps each migration in a transaction; partial applies won't happen.
2. Fix the migration SQL file in `prisma/migrations/<timestamp>_<name>/migration.sql`.
3. Run `migrate:deploy` again.

If data corruption occurred:

1. Restore from backup (see below).
2. Review and fix the migration.
3. Test on a staging database first.
4. Re-deploy.

## Backup Before Migration

```bash
# Create a timestamped backup
pg_dump "$DATABASE_URL" > "backup_$(date +%Y%m%d_%H%M%S).sql"

# Restore if needed
psql "$DATABASE_URL" < backup_20260216_120000.sql
```

Always take a backup before running `migrate:deploy` in production.

## Migration Best Practices

- Keep migrations small and focused — one logical change per migration.
- Never rename a column in one step; add the new column, migrate data, then drop the old one.
- Add `@default` values for new non-nullable columns so existing rows are valid.
- Test every migration against a copy of production data before deploying.
