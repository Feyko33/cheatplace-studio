-- Créer la table pour les emails bannis
CREATE TABLE IF NOT EXISTS public.banned_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  banned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  banned_by UUID REFERENCES auth.users(id),
  reason TEXT
);

-- RLS pour banned_emails
ALTER TABLE public.banned_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage banned emails"
ON public.banned_emails
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Créer la table pour tracker les téléchargements par utilisateur
CREATE TABLE IF NOT EXISTS public.user_downloads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  offer_id UUID NOT NULL REFERENCES public.offers(id) ON DELETE CASCADE,
  downloaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, offer_id, downloaded_at)
);

-- RLS pour user_downloads
ALTER TABLE public.user_downloads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own downloads"
ON public.user_downloads
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own downloads"
ON public.user_downloads
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Ajouter un compteur de connexions dans profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS login_count INTEGER NOT NULL DEFAULT 0;

-- Créer un index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_user_downloads_user_id ON public.user_downloads(user_id);
CREATE INDEX IF NOT EXISTS idx_user_downloads_offer_id ON public.user_downloads(offer_id);
CREATE INDEX IF NOT EXISTS idx_banned_emails_email ON public.banned_emails(email);