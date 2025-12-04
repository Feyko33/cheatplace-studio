-- Add media_url column for video previews in offers
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS media_url text;
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS media_type text DEFAULT 'image';