-- Extensões exigidas pela especificação: busca fuzzy, busca sem acento,
-- embeddings para reconhecimento por imagem (Fase 4) e citext para username case-insensitive.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Postgres 16 ainda não tem uuidv7() nativo (chega na v18). Implementação
-- padrão da comunidade: timestamp em milissegundos nos 48 bits mais
-- significativos, resto aleatório, com os bits de versão/variante corretos.
CREATE OR REPLACE FUNCTION uuid_generate_v7()
RETURNS uuid
AS $$
DECLARE
  unix_ts_ms bytea;
  rand_bytes bytea;
  result     bytea;
BEGIN
  unix_ts_ms := substring(int8send(floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint) FROM 3 FOR 6);
  rand_bytes := gen_random_bytes(10);

  result := unix_ts_ms || rand_bytes;
  -- versão 7 nos 4 bits altos do 7º byte
  result := set_byte(result, 6, (get_byte(result, 6) & 15) | 112);
  -- variante RFC 4122 nos 2 bits altos do 9º byte
  result := set_byte(result, 8, (get_byte(result, 8) & 63) | 128);

  RETURN encode(result, 'hex')::uuid;
END;
$$ LANGUAGE plpgsql VOLATILE;
