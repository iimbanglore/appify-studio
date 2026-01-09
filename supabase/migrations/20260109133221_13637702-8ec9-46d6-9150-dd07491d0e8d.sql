-- Add aab_download_url column for Android App Bundle downloads
ALTER TABLE public.builds 
ADD COLUMN aab_download_url TEXT DEFAULT NULL;