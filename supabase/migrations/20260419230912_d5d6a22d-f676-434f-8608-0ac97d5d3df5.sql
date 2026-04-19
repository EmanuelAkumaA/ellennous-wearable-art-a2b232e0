CREATE TABLE public.gallery_piece_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  piece_id uuid NOT NULL,
  event_type text NOT NULL,
  session_id text NOT NULL,
  duration_ms integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gallery_piece_events_event_type_check CHECK (event_type IN ('modal_open','cta_click','modal_close'))
);

CREATE INDEX idx_gallery_piece_events_piece_id ON public.gallery_piece_events(piece_id);
CREATE INDEX idx_gallery_piece_events_event_type ON public.gallery_piece_events(event_type);
CREATE INDEX idx_gallery_piece_events_created_at ON public.gallery_piece_events(created_at DESC);

ALTER TABLE public.gallery_piece_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert events"
ON public.gallery_piece_events
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Admins can view events"
ON public.gallery_piece_events
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));