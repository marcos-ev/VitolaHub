-- AlterEnum
CREATE TYPE "SupportMessageAuthor" AS ENUM ('USER', 'STAFF');

-- AlterTable: número público sequencial (VH-XXXX)
CREATE SEQUENCE "support_tickets_number_seq";

ALTER TABLE "support_tickets"
  ADD COLUMN "number" INTEGER NOT NULL DEFAULT nextval('support_tickets_number_seq'),
  ADD COLUMN "attachment_urls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "client_meta" JSONB,
  ADD COLUMN "helpful" BOOLEAN;

ALTER SEQUENCE "support_tickets_number_seq" OWNED BY "support_tickets"."number";

CREATE UNIQUE INDEX "support_tickets_number_key" ON "support_tickets"("number");

-- Assunto do mockup: até 60 caracteres
ALTER TABLE "support_tickets" ALTER COLUMN "subject" TYPE VARCHAR(60);

-- CreateTable
CREATE TABLE "support_ticket_messages" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "ticket_id" UUID NOT NULL,
    "author_type" "SupportMessageAuthor" NOT NULL,
    "author_id" UUID,
    "body" VARCHAR(4000) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_ticket_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "support_ticket_messages_ticket_id_created_at_idx"
  ON "support_ticket_messages"("ticket_id", "created_at");

ALTER TABLE "support_ticket_messages"
  ADD CONSTRAINT "support_ticket_messages_ticket_id_fkey"
  FOREIGN KEY ("ticket_id") REFERENCES "support_tickets"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: mensagem inicial a partir do body do ticket (se já houver registros)
INSERT INTO "support_ticket_messages" ("id", "ticket_id", "author_type", "author_id", "body", "created_at")
SELECT uuid_generate_v7(), t."id", 'USER', t."user_id", t."message", t."created_at"
FROM "support_tickets" t
WHERE NOT EXISTS (
  SELECT 1 FROM "support_ticket_messages" m WHERE m."ticket_id" = t."id"
);
