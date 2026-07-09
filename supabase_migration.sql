CREATE TABLE ai_queries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES companies(id) NOT NULL,
  user_id UUID REFERENCES users(id) NOT NULL,
  query TEXT NOT NULL,
  response TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ai_queries_company ON ai_queries(company_id);
CREATE INDEX idx_ai_queries_created ON ai_queries(created_at);

ALTER TABLE ai_queries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow insert for authenticated users" ON ai_queries
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow select for authenticated users" ON ai_queries
  FOR SELECT USING (true);
