-- CPF (PF) / CNPJ (PJ) no cadastro manual
ALTER TABLE "users" ADD COLUMN "tax_id" VARCHAR(14);

CREATE UNIQUE INDEX "users_tax_id_key" ON "users"("tax_id");
