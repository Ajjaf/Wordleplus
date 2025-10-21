import { PrismaClient } from "@prisma/client";
import fs from "node:fs";
import path from "node:path";

const prisma = new PrismaClient();

async function main() {
  console.log("Starting seed...");
  
  // Read words from server/words.txt
  const wordsPath = path.join(process.cwd(), "words.txt");
  
  if (!fs.existsSync(wordsPath)) {
    throw new Error(`Words file not found at ${wordsPath}`);
  }

  const raw = fs.readFileSync(wordsPath, "utf8");
  const words = Array.from(
    new Set(
      raw
        .split(/\r?\n/)
        .map(w => w.trim().toUpperCase())
        .filter(Boolean)
        .filter(w => /^[A-Z]{5}$/.test(w))
    )
  );

  console.log(`Found ${words.length} unique 5-letter words`);
  console.log("Seeding WordLexicon...");

  // Upsert in chunks to avoid hitting database limits
  const chunk = 1000;
  for (let i = 0; i < words.length; i += chunk) {
    const part = words.slice(i, i + chunk);
    await prisma.wordLexicon.createMany({
      data: part.map(w => ({ word: w, length: 5, active: true }))
    });
    console.log(`Seeded ${Math.min(i + chunk, words.length)}/${words.length} words`);
  }

  console.log("✅ Seed completed successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
