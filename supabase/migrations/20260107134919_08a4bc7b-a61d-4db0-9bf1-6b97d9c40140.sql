-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create builds table to track build status
CREATE TABLE public.builds (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  build_id TEXT NOT NULL UNIQUE,
  platform TEXT NOT NULL CHECK (platform IN ('android', 'ios')),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'building', 'completed', 'failed', 'canceled')),
  app_name TEXT NOT NULL,
  package_id TEXT,
  download_url TEXT,
  artifact_url TEXT,
  error_message TEXT,
  started_at TIMESTAMP WITH TIME ZONE,
  finished_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.builds ENABLE ROW LEVEL SECURITY;

-- Allow public read access (builds are not user-specific in this demo)
CREATE POLICY "Builds are publicly readable"
ON public.builds
FOR SELECT
USING (true);

-- Allow insert/update from service role
CREATE POLICY "Allow insert from service role"
ON public.builds
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Allow update from service role"
ON public.builds
FOR UPDATE
USING (true);

-- Enable realtime for builds table
ALTER PUBLICATION supabase_realtime ADD TABLE public.builds;

-- Create trigger for updated_at
CREATE TRIGGER update_builds_updated_at
BEFORE UPDATE ON public.builds
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();