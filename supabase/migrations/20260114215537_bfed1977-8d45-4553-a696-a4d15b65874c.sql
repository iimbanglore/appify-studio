-- Allow service role to update payments (for webhook)
CREATE POLICY "Service role can update payments"
ON public.payments
FOR UPDATE
USING (true)
WITH CHECK (true);