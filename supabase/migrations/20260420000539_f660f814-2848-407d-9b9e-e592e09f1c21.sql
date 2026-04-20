-- Tabela de convites para avaliação
CREATE TABLE public.review_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  revoked boolean NOT NULL DEFAULT false,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_review_invites_token ON public.review_invites(token);

ALTER TABLE public.review_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage invites select"
  ON public.review_invites FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage invites insert"
  ON public.review_invites FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage invites update"
  ON public.review_invites FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage invites delete"
  ON public.review_invites FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Público pode validar um convite (necessário para a página pública conferir o token)
CREATE POLICY "Public can validate invite by token"
  ON public.review_invites FOR SELECT
  TO anon, authenticated
  USING (true);

-- Tabela de avaliações
CREATE TABLE public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_id uuid REFERENCES public.review_invites(id) ON DELETE SET NULL,
  client_name text NOT NULL,
  client_role text,
  rating int NOT NULL CHECK (rating BETWEEN 1 AND 5),
  content text NOT NULL,
  photo_url text,
  photo_storage_path text,
  status text NOT NULL DEFAULT 'pending',
  ordem int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_reviews_status ON public.reviews(status);

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view approved reviews"
  ON public.reviews FOR SELECT
  TO anon, authenticated
  USING (status = 'approved');

CREATE POLICY "Admins view all reviews"
  ON public.reviews FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update reviews"
  ON public.reviews FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete reviews"
  ON public.reviews FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- INSERT é feito via edge function com service role; sem policy de insert para clientes

CREATE TRIGGER reviews_set_updated_at
  BEFORE UPDATE ON public.reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Bucket público para fotos das avaliações
INSERT INTO storage.buckets (id, name, public)
VALUES ('reviews', 'reviews', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Reviews photos public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'reviews');

CREATE POLICY "Reviews photos public upload"
  ON storage.objects FOR INSERT
  TO anon, authenticated
  WITH CHECK (bucket_id = 'reviews');

CREATE POLICY "Reviews photos admin delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'reviews' AND has_role(auth.uid(), 'admin'::app_role));