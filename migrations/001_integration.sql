-- Apply with a migration administrator, never the API role. No workout-schema change.
BEGIN;
DO $$ BEGIN
 IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='gymbro_api') THEN
  CREATE ROLE gymbro_api NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
 END IF;
END $$;
CREATE SCHEMA IF NOT EXISTS gymbro;
REVOKE ALL ON SCHEMA gymbro FROM PUBLIC;
GRANT USAGE ON SCHEMA gymbro TO gymbro_api;
CREATE TABLE IF NOT EXISTS gymbro.accounts (
 user_id uuid PRIMARY KEY, state jsonb, revision bigint NOT NULL DEFAULT 0 CHECK(revision>=0),
 CHECK (state IS NULL OR state->>'version'='7')
);
CREATE TABLE IF NOT EXISTS gymbro.grants (
 user_id uuid NOT NULL REFERENCES gymbro.accounts(user_id), client_id uuid NOT NULL,
 name text NOT NULL, scopes text[] NOT NULL CHECK(scopes <@ ARRAY['training:read','workout:write','history:modify']::text[]),
 not_before bigint NOT NULL, revoked_at timestamptz, PRIMARY KEY(user_id,client_id)
);
CREATE TABLE IF NOT EXISTS gymbro.receipts (
 user_id uuid NOT NULL REFERENCES gymbro.accounts(user_id), actor text NOT NULL, request_id text NOT NULL,
 signature text NOT NULL, result jsonb NOT NULL, PRIMARY KEY(user_id,actor,request_id)
);
CREATE TABLE IF NOT EXISTS gymbro.import_previews (
 user_id uuid NOT NULL REFERENCES gymbro.accounts(user_id), id uuid NOT NULL,
 state jsonb NOT NULL, digest text NOT NULL, revision bigint NOT NULL,
 expires_at timestamptz NOT NULL DEFAULT now()+interval '15 minutes', PRIMARY KEY(user_id,id)
);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['accounts','grants','receipts','import_previews'] LOOP
  EXECUTE format('ALTER TABLE gymbro.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE gymbro.%I FORCE ROW LEVEL SECURITY',t);
  IF NOT EXISTS(SELECT FROM pg_policies WHERE schemaname='gymbro' AND tablename=t AND policyname='user_isolation') THEN
   EXECUTE format($policy$CREATE POLICY user_isolation ON gymbro.%I TO gymbro_api USING (user_id = nullif(current_setting('gymbro.user_id',true),'')::uuid) WITH CHECK (user_id = nullif(current_setting('gymbro.user_id',true),'')::uuid)$policy$,t);
  END IF;
 END LOOP;
END $$;
REVOKE ALL ON ALL TABLES IN SCHEMA gymbro FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE ON gymbro.accounts, gymbro.grants TO gymbro_api;
GRANT SELECT, INSERT ON gymbro.receipts TO gymbro_api;
GRANT SELECT, INSERT, DELETE ON gymbro.import_previews TO gymbro_api;
DO $$ DECLARE r text; BEGIN
 FOREACH r IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
  IF EXISTS(SELECT FROM pg_roles WHERE rolname=r) THEN
   EXECUTE format('REVOKE ALL ON SCHEMA gymbro FROM %I',r);
   EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA gymbro FROM %I',r);
  END IF;
 END LOOP;
END $$;
COMMIT;
