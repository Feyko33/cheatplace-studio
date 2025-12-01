-- Table pour stocker les codes de vérification email
CREATE TABLE public.verification_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  code text NOT NULL,
  type text NOT NULL CHECK (type IN ('login', 'signup')),
  expires_at timestamp with time zone NOT NULL,
  verified boolean DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.verification_codes ENABLE ROW LEVEL SECURITY;

-- Policy pour que les utilisateurs puissent voir leurs propres codes
CREATE POLICY "Users can view their own codes"
ON public.verification_codes
FOR SELECT
USING (email = current_setting('request.jwt.claims', true)::json->>'email' OR user_id = auth.uid());

-- Policy pour permettre l'insertion publique (pour signup avant auth)
CREATE POLICY "Anyone can insert verification codes"
ON public.verification_codes
FOR INSERT
WITH CHECK (true);

-- Policy pour update (vérification)
CREATE POLICY "Anyone can update verification codes"
ON public.verification_codes
FOR UPDATE
USING (true);

-- Ajouter une policy pour que les admins puissent modifier les profils
CREATE POLICY "Admins can update all profiles"
ON public.profiles
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Index pour accélérer les recherches par email et code
CREATE INDEX idx_verification_codes_email ON public.verification_codes(email);
CREATE INDEX idx_verification_codes_code ON public.verification_codes(code);