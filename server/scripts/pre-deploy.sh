#!/bin/bash
set -e

echo "Pre-Deployment Checks"
echo "====================="
echo ""

FAIL=0

# Required environment variables
if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL is not set"
  FAIL=1
fi

if [ -z "$SESSION_SECRET" ]; then
  echo "WARNING: SESSION_SECRET is not set (required in production)"
fi

if [ "$NODE_ENV" != "production" ]; then
  echo "WARNING: NODE_ENV is '$NODE_ENV' (expected 'production')"
fi

if [ "$FAIL" -eq 1 ]; then
  echo ""
  echo "Fix the errors above and re-run."
  exit 1
fi

# Test database connection
echo "Testing database connection..."
npx prisma db execute --stdin <<< "SELECT 1" || {
  echo "ERROR: Cannot connect to database"
  exit 1
}
echo "Database connection OK"

# Generate Prisma Client
echo ""
echo "Generating Prisma Client..."
npx prisma generate

# Show migration status
echo ""
echo "Migration status:"
npx prisma migrate status

# Run tests
echo ""
echo "Running tests..."
npm test || {
  echo "ERROR: Tests failed — do not deploy"
  exit 1
}

echo ""
echo "All pre-deployment checks passed"
