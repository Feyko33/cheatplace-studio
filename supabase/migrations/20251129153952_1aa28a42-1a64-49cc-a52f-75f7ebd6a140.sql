-- Update storage bucket to allow all file types
UPDATE storage.buckets 
SET allowed_mime_types = ARRAY[
  'application/zip',
  'application/x-zip-compressed',
  'application/x-zip',
  'application/x-rar-compressed',
  'application/x-7z-compressed',
  'application/x-msdownload',
  'application/vnd.microsoft.portable-executable',
  'application/octet-stream',
  'text/plain',
  'text/html',
  'text/css',
  'text/x-python',
  'text/x-c',
  'text/x-c++',
  'application/x-php',
  'application/javascript',
  'application/json',
  'application/xml'
]::text[]
WHERE id = 'offer-files';