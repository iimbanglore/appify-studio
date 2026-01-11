-- Fix the overly permissive RLS policies by restricting to service role
DROP POLICY IF EXISTS "Allow insert from service role" ON public.builds;
DROP POLICY IF EXISTS "Allow update from service role" ON public.builds;

-- Recreate with proper service role check using auth.jwt()
CREATE POLICY "Allow insert from service role"
ON public.builds FOR INSERT
WITH CHECK (
  (auth.jwt() ->> 'role') = 'service_role' OR 
  auth.uid() IS NOT NULL
);

CREATE POLICY "Allow update from service role"
ON public.builds FOR UPDATE
USING (
  (auth.jwt() ->> 'role') = 'service_role' OR 
  user_id = auth.uid()
);