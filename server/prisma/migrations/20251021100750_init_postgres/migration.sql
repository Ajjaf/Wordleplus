-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "email" TEXT,
    "username" TEXT,
    "displayName" TEXT,
    "avatarUrl" TEXT,
    "authProvider" TEXT,
    "authExternalId" TEXT,
    "deviceId" TEXT,
    "totalWins" INTEGER NOT NULL DEFAULT 0,
    "totalGames" INTEGER NOT NULL DEFAULT 0,
    "streak" INTEGER NOT NULL DEFAULT 0,
    "longestStreak" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WordLexicon" (
    "id" SERIAL NOT NULL,
    "word" TEXT NOT NULL,
    "length" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "WordLexicon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyPuzzle" (
    "id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "word" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL DEFAULT 'medium',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "checksum" TEXT,

    CONSTRAINT "DailyPuzzle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyResult" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "puzzleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "guesses" JSONB NOT NULL,
    "patterns" JSONB NOT NULL,
    "attempts" INTEGER NOT NULL,
    "won" BOOLEAN NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "solved" BOOLEAN NOT NULL,
    "durationMs" INTEGER,
    "hardMode" BOOLEAN NOT NULL DEFAULT false,
    "submittedIp" TEXT,
    "userAgent" TEXT,
    "clientBuild" TEXT,

    CONSTRAINT "DailyResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "type" TEXT NOT NULL,
    "ts" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "roomId" TEXT,
    "meta" JSONB,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_authExternalId_key" ON "User"("authExternalId");

-- CreateIndex
CREATE UNIQUE INDEX "User_deviceId_key" ON "User"("deviceId");

-- CreateIndex
CREATE UNIQUE INDEX "WordLexicon_word_key" ON "WordLexicon"("word");

-- CreateIndex
CREATE INDEX "WordLexicon_length_active_idx" ON "WordLexicon"("length", "active");

-- CreateIndex
CREATE UNIQUE INDEX "DailyPuzzle_date_key" ON "DailyPuzzle"("date");

-- CreateIndex
CREATE INDEX "DailyResult_puzzleId_attempts_won_idx" ON "DailyResult"("puzzleId", "attempts", "won");

-- CreateIndex
CREATE UNIQUE INDEX "DailyResult_userId_puzzleId_key" ON "DailyResult"("userId", "puzzleId");

-- CreateIndex
CREATE INDEX "Event_type_ts_idx" ON "Event"("type", "ts");

-- CreateIndex
CREATE INDEX "Event_roomId_ts_idx" ON "Event"("roomId", "ts");

-- AddForeignKey
ALTER TABLE "DailyResult" ADD CONSTRAINT "DailyResult_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyResult" ADD CONSTRAINT "DailyResult_puzzleId_fkey" FOREIGN KEY ("puzzleId") REFERENCES "DailyPuzzle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
