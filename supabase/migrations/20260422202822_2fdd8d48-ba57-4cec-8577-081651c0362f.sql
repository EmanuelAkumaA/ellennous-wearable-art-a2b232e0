-- 1. Error log table
CREATE TABLE public.optimization_error_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  optimized_image_id uuid NOT NULL,
  piece_id uuid,
  stage text NOT NULL,
  error_message text NOT NULL,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_optimization_error_log_image
  ON public.optimization_error_log (optimized_image_id, created_at DESC);

CREATE INDEX idx_optimization_error_log_piece
  ON public.optimization_error_log (piece_id, created_at DESC);

ALTER TABLE public.optimization_error_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read optimization error log"
  ON public.optimization_error_log
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins insert optimization error log"
  ON public.optimization_error_log
  FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 2. Unstuck processing images (older than 5 minutes)
UPDATE public.optimized_images
SET status = 'error',
    error_message = 'Função de otimização indisponível (corrigida em 22/04). Clique em Reprocessar.',
    updated_at = now()
WHERE status = 'processing'
  AND updated_at < now() - interval '5 minutes';