-- Make the offer-files bucket public so files can be downloaded
UPDATE storage.buckets
SET public = true
WHERE id = 'offer-files';