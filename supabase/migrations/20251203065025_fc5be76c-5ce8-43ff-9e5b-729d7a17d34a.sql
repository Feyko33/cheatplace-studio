-- Create banned_ips table
CREATE TABLE public.banned_ips (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ip_address TEXT NOT NULL UNIQUE,
  banned_by UUID REFERENCES public.profiles(id),
  banned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  reason TEXT
);

-- Enable RLS
ALTER TABLE public.banned_ips ENABLE ROW LEVEL SECURITY;

-- Only admins can manage banned IPs
CREATE POLICY "Admins can manage banned IPs"
  ON public.banned_ips
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Anyone can read banned IPs (for checking)
CREATE POLICY "Anyone can read banned IPs"
  ON public.banned_ips
  FOR SELECT
  USING (true);