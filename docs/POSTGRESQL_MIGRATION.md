# PostgreSQL Migration Guide

This guide explains how to migrate from SQLite (development) to PostgreSQL (production) for the WordlePlus application.

## 🎯 Overview

The application currently uses SQLite for development, but can be easily migrated to PostgreSQL for production use.

## 📋 Prerequisites

- PostgreSQL server running
- Database created
- Connection details in `.env` file

## 🔧 Step-by-Step Migration

### 1. Update Prisma Schema

Change the datasource in `server/prisma/schema.prisma`:

```prisma
// Change from:
datasource db {
  provider = "sqlite"
  url      = "file:./dev.db"
}

// To:
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

### 2. Update Environment Variables

Ensure your `server/.env` file contains:

```env
# PostgreSQL connection string
DATABASE_URL="postgresql://username:password@localhost:5432/wordleplus"

# Example with specific values:
# DATABASE_URL="postgresql://postgres:mypassword@localhost:5432/wordleplus"
```

### 3. Fix Schema Compatibility Issues

**Important:** PostgreSQL doesn't support arrays of primitive types like SQLite. Update the schema:

```prisma
model DailyResult {
  // Change from:
  guesses      String[] // ❌ Not supported in PostgreSQL
  patterns     Json[]   // ❌ Not supported in PostgreSQL

  // To:
  guesses      Json     // ✅ Store as JSON array
  patterns     Json     // ✅ Store as JSON array
}
```

### 4. Generate New Migration

```bash
cd server
npx prisma migrate dev --name "postgresql-migration"
```

### 5. Seed the Database

```bash
cd server
npx tsx prisma/seed.ts
```

### 6. Update Code (if needed)

The application code should work without changes since we're using JSON fields, but verify:

- `daily-db.js` - Check JSON handling
- Any direct database queries
- Data serialization/deserialization

## 🔄 Data Migration (if needed)

If you have existing SQLite data to migrate:

### Option 1: Fresh Start (Recommended)

- Run the seed script to populate word lexicon
- Users will start fresh (no previous game data)

### Option 2: Data Export/Import

```bash
# Export from SQLite (if needed)
sqlite3 dev.db .dump > backup.sql

# Import to PostgreSQL (manual process)
# Note: This requires custom scripts due to schema differences
```

## 🚀 Production Deployment

### Environment Setup

```env
# Production .env
DATABASE_URL="postgresql://prod_user:secure_password@prod_host:5432/wordleplus_prod"
NODE_ENV="production"
```

### Database Commands

```bash
# Deploy migrations to production
npx prisma migrate deploy

# Generate production client
npx prisma generate
```

## 🧪 Testing the Migration

### 1. Test Database Connection

```bash
cd server
npx prisma db pull
```

### 2. Test Daily Challenge

- Start the server
- Try loading a daily challenge
- Verify word selection works

### 3. Test All Game Modes

- Duel mode
- Battle mode
- Shared mode
- Daily challenges

## 🐛 Troubleshooting

### Common Issues

**Connection Refused**
