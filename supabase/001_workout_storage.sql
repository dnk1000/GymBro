-- Apply once in this GymBro Supabase project's SQL Editor. No personal data is inserted.
-- Workout schema remains 7. auth.users and Supabase JWT verification supply identity.
BEGIN;
CREATE SCHEMA IF NOT EXISTS gymbro_private;
REVOKE ALL ON SCHEMA gymbro_private FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS public.gymbro_workout_state (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 revision bigint NOT NULL CHECK (revision>0),
 state jsonb NOT NULL CHECK (jsonb_typeof(state)='object' AND state->>'version'='7'),
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.gymbro_workout_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gymbro_workout_state FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gymbro_read_own ON public.gymbro_workout_state;
CREATE POLICY gymbro_read_own ON public.gymbro_workout_state FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid()));
REVOKE ALL ON public.gymbro_workout_state FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.gymbro_workout_state TO authenticated;
CREATE TABLE IF NOT EXISTS gymbro_private.save_receipts (
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 request_id uuid NOT NULL, signature text NOT NULL, revision bigint NOT NULL,
 PRIMARY KEY(user_id,request_id)
);
ALTER TABLE gymbro_private.save_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE gymbro_private.save_receipts FORCE ROW LEVEL SECURITY;
REVOKE ALL ON gymbro_private.save_receipts FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.gymbro_save(p_state jsonb,p_expected_revision bigint,p_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog
AS $$
DECLARE uid uuid:=auth.uid(); current_revision bigint; previous gymbro_private.save_receipts; signature text;
BEGIN
 IF uid IS NULL THEN RAISE EXCEPTION 'Sign in required' USING ERRCODE='28000'; END IF;
 IF p_request_id IS NULL OR p_expected_revision IS NULL OR p_expected_revision<0 THEN RAISE EXCEPTION 'Invalid save identity'; END IF;
 IF p_state IS NULL OR jsonb_typeof(p_state) IS DISTINCT FROM 'object' OR p_state->>'version' IS DISTINCT FROM '7'
   OR jsonb_typeof(p_state->'sets') IS DISTINCT FROM 'array'
   OR jsonb_typeof(p_state->'sessions') IS DISTINCT FROM 'array'
   OR jsonb_typeof(p_state->'bodyweights') IS DISTINCT FROM 'array'
   OR jsonb_typeof(p_state->'imports') IS DISTINCT FROM 'array'
   OR jsonb_typeof(p_state->'program') IS DISTINCT FROM 'object'
   OR jsonb_typeof(p_state->'exerciseLibrary') IS DISTINCT FROM 'object'
   OR jsonb_typeof(p_state->'preferences') IS DISTINCT FROM 'object'
   OR NOT(p_state ? 'activeSessionId') THEN RAISE EXCEPTION 'Invalid schema-7 workout state'; END IF;
 -- Serialize initial imports as well as updates, even when no state row exists yet.
 PERFORM pg_advisory_xact_lock(hashtextextended(uid::text,0));
 signature:=encode(sha256(convert_to(p_state::text||':'||p_expected_revision::text,'UTF8')),'hex');
 SELECT revision INTO current_revision FROM public.gymbro_workout_state WHERE user_id=uid;
 SELECT * INTO previous FROM gymbro_private.save_receipts WHERE user_id=uid AND request_id=p_request_id;
 IF FOUND THEN
  IF previous.signature<>signature THEN RETURN jsonb_build_object('ok',false,'code','REQUEST_CONFLICT'); END IF;
  RETURN jsonb_build_object('ok',true,'code','REPLAY','revision',previous.revision,'current_revision',current_revision);
 END IF;
 IF coalesce(current_revision,0)<>p_expected_revision THEN RETURN jsonb_build_object('ok',false,'code','REVISION_CONFLICT'); END IF;
 INSERT INTO public.gymbro_workout_state(user_id,revision,state) VALUES(uid,p_expected_revision+1,p_state)
 ON CONFLICT(user_id) DO UPDATE SET state=excluded.state,revision=excluded.revision,updated_at=now();
 INSERT INTO gymbro_private.save_receipts VALUES(uid,p_request_id,signature,p_expected_revision+1);
 RETURN jsonb_build_object('ok',true,'code','OK','revision',p_expected_revision+1,'current_revision',p_expected_revision+1);
END;
$$;
REVOKE ALL ON FUNCTION public.gymbro_save(jsonb,bigint,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.gymbro_save(jsonb,bigint,uuid) TO authenticated;
COMMIT;
