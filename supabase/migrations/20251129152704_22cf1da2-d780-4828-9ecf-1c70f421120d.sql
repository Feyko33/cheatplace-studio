-- Create storage bucket for offer files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'offer-files',
  'offer-files',
  false,
  52428800, -- 50MB limit
  ARRAY['application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed', 'application/octet-stream', 'application/x-msdownload']
);

-- Storage policies for offer files
CREATE POLICY "Authenticated users can view offer files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'offer-files');

CREATE POLICY "Vendors can upload offer files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'offer-files' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Vendors can update own offer files"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'offer-files' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Vendors can delete own offer files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'offer-files' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- CRITICAL SECURITY FIX: Create separate user_roles table
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Create helper function to get user role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role 
  FROM public.user_roles 
  WHERE user_id = _user_id 
  ORDER BY 
    CASE role
      WHEN 'admin' THEN 1
      WHEN 'vendor' THEN 2
      WHEN 'client' THEN 3
    END
  LIMIT 1
$$;

-- Migrate existing roles from profiles to user_roles
INSERT INTO public.user_roles (user_id, role)
SELECT id, role FROM public.profiles
ON CONFLICT (user_id, role) DO NOTHING;

-- RLS policies for user_roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Admins can view all roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can manage roles"
ON public.user_roles FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Update profiles table - remove role column (keep for backward compatibility for now)
-- We'll phase it out in code but keep the column to avoid breaking changes

-- Update handle_new_user function to use user_roles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _role app_role;
BEGIN
  _role := COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'client');
  
  -- Insert into profiles
  INSERT INTO public.profiles (id, username, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', NEW.email),
    _role
  );
  
  -- Insert into user_roles (the secure way)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, _role)
  ON CONFLICT (user_id, role) DO NOTHING;
  
  -- Log user registration
  INSERT INTO public.logs (user_id, action_type, message, metadata)
  VALUES (
    NEW.id,
    'user_registered',
    'Nouvel utilisateur enregistré',
    jsonb_build_object('username', COALESCE(NEW.raw_user_meta_data->>'username', NEW.email))
  );
  
  RETURN NEW;
END;
$$;

-- Update all RLS policies to use has_role function

-- Announcements policies
DROP POLICY IF EXISTS "Vendors can create announcements" ON public.announcements;
CREATE POLICY "Vendors can create announcements"
ON public.announcements FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = author_id AND 
  (public.has_role(auth.uid(), 'vendor') OR public.has_role(auth.uid(), 'admin'))
);

DROP POLICY IF EXISTS "Authors and admins can update announcements" ON public.announcements;
CREATE POLICY "Authors and admins can update announcements"
ON public.announcements FOR UPDATE
TO authenticated
USING (
  auth.uid() = author_id OR public.has_role(auth.uid(), 'admin')
);

DROP POLICY IF EXISTS "Authors and admins can delete announcements" ON public.announcements;
CREATE POLICY "Authors and admins can delete announcements"
ON public.announcements FOR DELETE
TO authenticated
USING (
  auth.uid() = author_id OR public.has_role(auth.uid(), 'admin')
);

-- Offers policies
DROP POLICY IF EXISTS "Vendors can create offers" ON public.offers;
CREATE POLICY "Vendors can create offers"
ON public.offers FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = vendor_id AND 
  (public.has_role(auth.uid(), 'vendor') OR public.has_role(auth.uid(), 'admin'))
);

DROP POLICY IF EXISTS "Vendors can update own offers" ON public.offers;
CREATE POLICY "Vendors can update own offers"
ON public.offers FOR UPDATE
TO authenticated
USING (
  auth.uid() = vendor_id OR public.has_role(auth.uid(), 'admin')
);

DROP POLICY IF EXISTS "Admins and owners can delete offers" ON public.offers;
CREATE POLICY "Admins and owners can delete offers"
ON public.offers FOR DELETE
TO authenticated
USING (
  auth.uid() = vendor_id OR public.has_role(auth.uid(), 'admin')
);

-- Logs policies
DROP POLICY IF EXISTS "Vendors and admins can view logs" ON public.logs;
CREATE POLICY "Vendors and admins can view logs"
ON public.logs FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'vendor') OR public.has_role(auth.uid(), 'admin')
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles(role);