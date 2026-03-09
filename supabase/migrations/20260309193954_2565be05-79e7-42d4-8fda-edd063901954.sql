
-- Create storage bucket for profile analysis PDFs
INSERT INTO storage.buckets (id, name, public) VALUES ('profile-pdfs', 'profile-pdfs', false);

-- Allow authenticated users to upload PDFs
CREATE POLICY "Authenticated users can upload PDFs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'profile-pdfs' AND (auth.jwt() ->> 'email') = 'contato@allancatao.com.br');

-- Allow authenticated users to read their PDFs
CREATE POLICY "Authenticated users can read PDFs"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'profile-pdfs' AND (auth.jwt() ->> 'email') = 'contato@allancatao.com.br');
