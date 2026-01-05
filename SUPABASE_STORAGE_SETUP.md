# Supabase Storage Setup Guide

To enable file uploads, you need to create a storage bucket and set up security policies.

## 1. Open SQL Editor
Go to your Supabase Dashboard -> SQL Editor and run the following commands:

```sql
-- 1. Create the 'uploads' bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('uploads', 'uploads', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Enable Row Level Security (RLS)
-- (Buckets usually have RLS enabled by default, but good to ensure)

-- 3. Create Policy: Allow Public Read Access
-- This lets anyone see the images/audio on your website
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'uploads' );

-- 4. Create Policy: Allow Authenticated Uploads
-- This lets logged-in users (you) upload files
CREATE POLICY "Authenticated Uploads"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'uploads' );

-- 5. Create Policy: Allow Authenticated Deletes (Optional)
-- This lets you delete files if needed
CREATE POLICY "Authenticated Deletes"
ON storage.objects FOR DELETE
TO authenticated
USING ( bucket_id = 'uploads' );
```

## 2. Verify in Dashboard
1. Go to **Storage** in the left sidebar.
2. You should see a bucket named `uploads`.
3. Try uploading a file again from your Admin panel.
