-- Function to safely increment offer download counter, callable by public clients
CREATE OR REPLACE FUNCTION public.increment_offer_download(
  _offer_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
BEGIN
  UPDATE public.offers
  SET download_count = download_count + 1
  WHERE id = _offer_id;
END;
$$;