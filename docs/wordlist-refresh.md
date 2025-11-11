# Word List Refresh Workflow

This note documents the exact steps we followed to refresh the Wordle+ vocabulary and why each command behaves the way it does. Keep it handy whenever you update `server/words.txt`.

---

## High-level flow

1. **Update lists on disk**  
   - `server/words.txt` → curated solutions (≈2.2k common words).  
   - `server/allowed_guesses.txt` → full guess lexicon (≈12.9k words).

2. **Wire up Prisma’s seeder**  
   - Added `tsx` to `devDependencies` and the `prisma.seed` hook in `server/package.json`.  
   - This lets `npx prisma db seed` run `tsx prisma/seed.ts`, which loads `words.txt` and bulk-inserts into the database.

3. **Reset the database table**  
   - Clear `WordLexicon` so we can insert the new list without unique-key conflicts.

4. **Reseed**  
   - Run the seeder to repopulate `WordLexicon` with the curated entries.

---

## The truncate + seed commands explained

### 1. Clearing the table

```powershell
'TRUNCATE "WordLexicon" RESTART IDENTITY CASCADE;' |
  npx prisma db execute --schema prisma/schema.prisma --stdin
```

- `TRUNCATE "WordLexicon" RESTART IDENTITY CASCADE;` is a SQL statement that:
  - Deletes all rows from `WordLexicon`.
  - Resets the auto-incrementing primary key (`RESTART IDENTITY`).
  - Cascades the deletion to any dependent tables (`CASCADE`), ensuring referential integrity.
- In PowerShell, the vertical bar `|` is a **pipeline operator**. It takes the string on the left and passes it as input to the command on the right.
  - In this case, PowerShell sends the SQL statement to Prisma via standard input.
- `npx prisma db execute ... --stdin` tells Prisma to read the SQL command from **standard input** instead of a separate file.
  - `--schema prisma/schema.prisma` ensures Prisma targets the correct database connection from that schema file.
  - Prisma executes the SQL immediately against the database referenced in `DATABASE_URL`.

> The `| ... --stdin` pattern is a convenient alternative to writing the SQL into a temporary file. It’s the PowerShell way of saying “execute this inline SQL text”.

### 2. (Optional) Sanity-check the count

```powershell
'SELECT COUNT(*) FROM "WordLexicon";' |
  npx prisma db execute --schema prisma/schema.prisma --stdin
```

If you run this right after the truncate, the result should be `0` rows. Running it after seeding should show the new total (e.g., `2266`).

### 3. Reseeding with the curated list

```powershell
npx prisma db seed
```

- Because `server/package.json` now contains:

  ```json
  "prisma": {
    "seed": "tsx prisma/seed.ts"
  }
  ```

  Prisma knows to execute `tsx prisma/seed.ts`.

- `tsx prisma/seed.ts` transpiles and runs the TypeScript seeding script. That script:
  1. Reads `server/words.txt`.
  2. Deduplicates and uppercases the words.
  3. Inserts them into `WordLexicon` using `createMany` in 1000-word batches.

If the truncate step ran successfully, there are no existing rows to clash with, so the insert finishes cleanly.

---

## Why the first seed attempts failed

- When the table still held 12,972 legacy rows, `createMany` hit the unique constraint on `word`.  
- Clearing the table first (with `TRUNCATE`) removed those rows and reset the IDs, so the subsequent insert no longer conflicted.

---

## Ongoing usage

Whenever you adjust the curated list:

1. Edit `server/words.txt` and re-run `python server/scripts/curate_words.py --threshold …` if needed.
2. Truncate `WordLexicon`.
3. Run `npx prisma db seed`.
4. (Optional) Verify the new row count with the `SELECT COUNT(*) ...` snippet or by opening Prisma Studio (`npx prisma studio`).

That’s everything we did—captured for future you. 👍
