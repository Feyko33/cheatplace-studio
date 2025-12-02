-- Créer une fonction pour incrémenter le compteur de connexions
CREATE OR REPLACE FUNCTION public.increment_login_count(user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET login_count = login_count + 1
  WHERE id = user_id;
END;
$$;