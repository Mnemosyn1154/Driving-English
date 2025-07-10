-- Drop difficulty index on Article table
DROP INDEX IF EXISTS "Article_difficulty_idx";

-- Remove difficulty column from Article table
ALTER TABLE "Article" DROP COLUMN IF EXISTS "difficulty";

-- Remove difficulty column from Sentence table
ALTER TABLE "Sentence" DROP COLUMN IF EXISTS "difficulty";

-- Remove preferredLevel column from User table
ALTER TABLE "User" DROP COLUMN IF EXISTS "preferredLevel";
EOF < /dev/null