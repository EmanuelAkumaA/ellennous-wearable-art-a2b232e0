-- Remove SELECT público em review_invites — validação será feita via edge function (service role)
DROP POLICY IF EXISTS "Public can validate invite by token" ON public.review_invites;