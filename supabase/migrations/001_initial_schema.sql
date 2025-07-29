-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create sources table
CREATE TABLE IF NOT EXISTS sources (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('exa', 'sec', 'ftc', 'native')),
  url TEXT,
  last_checked TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  config JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create cases table
CREATE TABLE IF NOT EXISTS cases (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  source_id UUID REFERENCES sources(id),
  title TEXT NOT NULL,
  description TEXT,
  eligibility_criteria JSONB,
  deadline_date DATE,
  claim_url TEXT UNIQUE,
  proof_required BOOLEAN DEFAULT false,
  estimated_payout TEXT,
  category TEXT,
  raw_text TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'expired', 'duplicate')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_sources_type ON sources(type);
CREATE INDEX IF NOT EXISTS idx_sources_active ON sources(is_active);
CREATE INDEX IF NOT EXISTS idx_sources_last_checked ON sources(last_checked);

CREATE INDEX IF NOT EXISTS idx_cases_status ON cases(status);
CREATE INDEX IF NOT EXISTS idx_cases_deadline ON cases(deadline_date);
CREATE INDEX IF NOT EXISTS idx_cases_category ON cases(category);
CREATE INDEX IF NOT EXISTS idx_cases_created_at ON cases(created_at);
CREATE INDEX IF NOT EXISTS idx_cases_source_id ON cases(source_id);
CREATE INDEX IF NOT EXISTS idx_cases_claim_url ON cases(claim_url);

-- Create full-text search index on case titles and descriptions
CREATE INDEX IF NOT EXISTS idx_cases_search ON cases USING gin(to_tsvector('english', title || ' ' || COALESCE(description, '')));

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_cases_updated_at BEFORE UPDATE ON cases
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default sources
INSERT INTO sources (name, type, url, config) VALUES
  ('Exa Web Search', 'exa', NULL, '{"queries": ["class action settlement", "consumer refund program"], "numResults": 50}'),
  ('FTC Press Releases', 'ftc', 'https://www.ftc.gov/news-events/news/press-releases', '{"keywords": ["settlement", "refund", "consumer"]}'),
  ('SEC EDGAR Filings', 'sec', 'https://data.sec.gov', '{"forms": ["8-K", "10-K", "10-Q"], "keywords": ["litigation", "settlement"]}')
ON CONFLICT DO NOTHING;

-- Create a view for active cases with source information
CREATE OR REPLACE VIEW active_cases_with_source AS
SELECT 
  c.*,
  s.name as source_name,
  s.type as source_type,
  s.url as source_url
FROM cases c
LEFT JOIN sources s ON c.source_id = s.id
WHERE c.status = 'active';

-- Enable Row Level Security

-- In production with auth, you'd restrict based on user roles

-- Sources are publicly readable for the collectors to work
-- but only service role can modify them
ALTER TABLE sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sources are publicly readable" ON sources
  FOR SELECT USING (true);

CREATE POLICY "Only service role can modify sources" ON sources
  FOR ALL USING (current_setting('role') = 'service_role');

-- Cases are publicly readable for users to browse opportunities
-- but only service role can modify them
ALTER TABLE cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cases are publicly readable" ON cases
  FOR SELECT USING (true);

CREATE POLICY "Only service role can modify cases" ON cases
  FOR ALL USING (current_setting('role') = 'service_role');

-- Future: When adding user authentication, add these policies:
-- 
-- For user-specific data (pre_check_responses, user_cases):
-- CREATE POLICY "Users can view own responses" ON pre_check_responses
--   FOR SELECT USING (auth.uid() = user_id);
-- 
-- CREATE POLICY "Users can insert own responses" ON pre_check_responses
--   FOR INSERT WITH CHECK (auth.uid() = user_id);
--
-- CREATE POLICY "Users can update own responses" ON pre_check_responses
--   FOR UPDATE USING (auth.uid() = user_id);
