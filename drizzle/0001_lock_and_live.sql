-- Block Supabase's auto-generated Data API from these tables. The app connects as the
-- database owner, which bypasses RLS. No policies = no access from the browser.
ALTER TABLE "classrooms" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "students" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "point_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

-- Supabase-only parts. They are skipped on the in-memory test database, which has no auth or realtime.
DO $$
BEGIN
  IF to_regclass('realtime.messages') IS NULL THEN
    RETURN;
  END IF;

  -- Removing a teacher's account removes their classes.
  ALTER TABLE public.classrooms
    ADD CONSTRAINT classrooms_owner_fk FOREIGN KEY (owner_id) REFERENCES auth.users (id) ON DELETE CASCADE;

  -- Only a class's owner may join its live channel. Runs as the table owner because
  -- teachers have no direct access to the table.
  CREATE FUNCTION public.owns_class_channel(topic text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
    AS $fn$
      SELECT EXISTS (
        SELECT 1 FROM public.classrooms c
        WHERE 'class:' || c.id::text = topic AND c.owner_id = auth.uid()
      );
    $fn$;
  REVOKE ALL ON FUNCTION public.owns_class_channel(text) FROM PUBLIC, anon;
  GRANT EXECUTE ON FUNCTION public.owns_class_channel(text) TO authenticated;

  CREATE POLICY "class owner can listen" ON realtime.messages
    FOR SELECT TO authenticated
    USING (realtime.messages.extension = 'broadcast' AND public.owns_class_channel(realtime.topic()));
END $$;
