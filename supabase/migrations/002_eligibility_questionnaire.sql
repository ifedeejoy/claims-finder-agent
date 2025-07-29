-- Add fields to cases table for full claim details
ALTER TABLE cases ADD COLUMN IF NOT EXISTS full_description TEXT;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS how_to_claim TEXT;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS important_dates JSONB;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS contact_info JSONB;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS faqs JSONB;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS documentation_required TEXT[];
ALTER TABLE cases ADD COLUMN IF NOT EXISTS claim_form_url TEXT;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS external_redirect BOOLEAN DEFAULT true;

-- Create eligibility questions table
CREATE TABLE IF NOT EXISTS eligibility_questions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID REFERENCES cases(id) ON DELETE CASCADE,
  question_order INTEGER NOT NULL,
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL CHECK (question_type IN ('boolean', 'multiple_choice', 'text', 'date', 'number')),
  options JSONB, -- For multiple choice questions
  required BOOLEAN DEFAULT true,
  disqualifying_answers JSONB, -- Answers that would disqualify the user
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create user responses table
CREATE TABLE IF NOT EXISTS user_eligibility_responses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID REFERENCES cases(id) ON DELETE CASCADE,
  user_identifier TEXT NOT NULL, -- Can be email or anonymous ID
  responses JSONB NOT NULL, -- All answers stored as JSON
  is_eligible BOOLEAN,
  eligibility_score INTEGER, -- 0-100 score
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Prevent duplicate submissions
  UNIQUE(case_id, user_identifier)
);

-- Create claim templates table for common claim types
CREATE TABLE IF NOT EXISTS claim_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  default_questions JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert some default claim templates
INSERT INTO claim_templates (name, category, default_questions) VALUES
(
  'Data Breach Settlement',
  'data_breach',
  '[
    {
      "question_text": "Were you a customer of the company during the breach period?",
      "question_type": "boolean",
      "disqualifying_answers": [false]
    },
    {
      "question_text": "Did you receive a breach notification letter?",
      "question_type": "boolean",
      "required": false
    },
    {
      "question_text": "Which of the following applies to you?",
      "question_type": "multiple_choice",
      "options": ["Had fraudulent charges", "Spent time dealing with the breach", "Had identity theft", "None of the above"],
      "required": true
    }
  ]'::jsonb
),
(
  'Product Defect Settlement',
  'product_defect',
  '[
    {
      "question_text": "Did you purchase the affected product?",
      "question_type": "boolean",
      "disqualifying_answers": [false]
    },
    {
      "question_text": "Do you still have proof of purchase?",
      "question_type": "boolean",
      "required": false
    },
    {
      "question_text": "When did you purchase the product?",
      "question_type": "date",
      "required": true
    }
  ]'::jsonb
),
(
  'Financial Services Settlement',
  'financial_services',
  '[
    {
      "question_text": "Were you a customer during the class period?",
      "question_type": "boolean",
      "disqualifying_answers": [false]
    },
    {
      "question_text": "Which fees were you charged?",
      "question_type": "multiple_choice",
      "options": ["Overdraft fees", "NSF fees", "Monthly maintenance fees", "ATM fees", "Other"],
      "required": true
    },
    {
      "question_text": "What is your estimated total in fees?",
      "question_type": "number",
      "required": false
    }
  ]'::jsonb
);

-- Create views for easier querying
CREATE OR REPLACE VIEW cases_with_questions AS
SELECT 
  c.*,
  COUNT(eq.id) as question_count,
  COALESCE(json_agg(
    json_build_object(
      'id', eq.id,
      'question_order', eq.question_order,
      'question_text', eq.question_text,
      'question_type', eq.question_type,
      'options', eq.options,
      'required', eq.required
    ) ORDER BY eq.question_order
  ) FILTER (WHERE eq.id IS NOT NULL), '[]'::json) as questions
FROM cases c
LEFT JOIN eligibility_questions eq ON c.id = eq.case_id
GROUP BY c.id;

-- Create RLS policies
ALTER TABLE eligibility_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_eligibility_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE claim_templates ENABLE ROW LEVEL SECURITY;

-- Everyone can read questions
CREATE POLICY "Public read access to questions" ON eligibility_questions
  FOR SELECT USING (true);

-- Only service role can modify questions
CREATE POLICY "Service role manage questions" ON eligibility_questions
  FOR ALL USING (auth.role() = 'service_role');

-- Users can submit their own responses
CREATE POLICY "Users can submit responses" ON user_eligibility_responses
  FOR INSERT WITH CHECK (true);

-- Users can view their own responses
CREATE POLICY "Users can view own responses" ON user_eligibility_responses
  FOR SELECT USING (
    user_identifier = auth.uid()::text OR 
    user_identifier = auth.jwt()->>'email'
  );

-- Public read access to templates
CREATE POLICY "Public read access to templates" ON claim_templates
  FOR SELECT USING (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_eligibility_questions_case_id ON eligibility_questions(case_id);
CREATE INDEX IF NOT EXISTS idx_eligibility_questions_order ON eligibility_questions(case_id, question_order);
CREATE INDEX IF NOT EXISTS idx_user_responses_case_id ON user_eligibility_responses(case_id);
CREATE INDEX IF NOT EXISTS idx_user_responses_identifier ON user_eligibility_responses(user_identifier); 