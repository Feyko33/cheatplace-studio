-- Update storage bucket configuration for larger file sizes (150MB)
UPDATE storage.buckets 
SET file_size_limit = 157286400 
WHERE id = 'offer-files';

-- Also add media file types to the allowed list if needed
-- The bucket should already be public, just updating the size limit