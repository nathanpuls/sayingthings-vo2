-- Enable RLS and add policies for data isolation
-- Copy and run this in your Supabase SQL Editor

-- 1. Site Settings
ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;
-- Allow anyone to read settings (needed for public profiles)
CREATE POLICY "Public read settings" ON site_settings FOR SELECT USING (true);
-- Allow only the owner to insert/update/delete their own settings
CREATE POLICY "Owner write settings" ON site_settings FOR ALL USING (auth.uid() = user_id);


-- 2. Demos
ALTER TABLE demos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read demos" ON demos FOR SELECT USING (true);
CREATE POLICY "Owner write demos" ON demos FOR ALL USING (auth.uid() = user_id);


-- 3. Videos
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read videos" ON videos FOR SELECT USING (true);
CREATE POLICY "Owner write videos" ON videos FOR ALL USING (auth.uid() = user_id);


-- 4. Studio Gear
ALTER TABLE studio_gear ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read studio" ON studio_gear FOR SELECT USING (true);
CREATE POLICY "Owner write studio" ON studio_gear FOR ALL USING (auth.uid() = user_id);


-- 5. Clients
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read clients" ON clients FOR SELECT USING (true);
CREATE POLICY "Owner write clients" ON clients FOR ALL USING (auth.uid() = user_id);


-- 6. Reviews
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read reviews" ON reviews FOR SELECT USING (true);
CREATE POLICY "Owner write reviews" ON reviews FOR ALL USING (auth.uid() = user_id);


-- 7. Messages (Private to owner)
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
-- Anyone can send a message (public insert)
CREATE POLICY "Public insert messages" ON messages FOR INSERT WITH CHECK (true);
-- Only owner can read their messages
CREATE POLICY "Owner read messages" ON messages FOR SELECT USING (auth.uid() = user_id);
-- Only owner can delete their messages
CREATE POLICY "Owner delete messages" ON messages FOR DELETE USING (auth.uid() = user_id);
