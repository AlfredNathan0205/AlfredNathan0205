-- ============================================
-- SCENTSHIELD AI — Database Schema
-- Migration: 001_initial_schema
-- ============================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================
-- ENUMS
-- ============================================

CREATE TYPE subscription_tier AS ENUM ('free_trial', 'indie', 'professional', 'enterprise');
CREATE TYPE compliance_status AS ENUM ('pass', 'warn', 'fail', 'na', 'pending');
CREATE TYPE ifra_status AS ENUM ('no_restriction', 'restriction', 'specification', 'prohibition');
CREATE TYPE reach_status AS ENUM ('registered', 'pre_registered', 'exempt', 'svhc_candidate', 'authorisation_list', 'restricted', 'unknown');
CREATE TYPE document_type AS ENUM ('sds', 'label', 'pcn', 'cpnp', 'cpsr_part_a', 'cpsr_part_b', 'transport', 'scip');
CREATE TYPE alert_severity AS ENUM ('info', 'warning', 'critical');
CREATE TYPE alert_type AS ENUM ('regulatory_change', 'formula_noncompliant', 'pcn_update_required', 'deadline_approaching', 'allergen_update', 'system');
CREATE TYPE lead_status AS ENUM ('identified', 'contacted', 'responded', 'trialing', 'converted', 'lost');
CREATE TYPE agent_event_type AS ENUM (
  'regulation_changed', 'formula_created', 'formula_updated', 'formula_noncompliant',
  'customer_signed_up', 'customer_churning', 'payment_failed', 'payment_succeeded',
  'support_ticket_created', 'content_scheduled', 'lead_identified',
  'complaint_received', 'document_generated', 'trial_expiring'
);

-- ============================================
-- TENANTS (Companies / Brands)
-- ============================================

CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  vat_number TEXT,
  country_code CHAR(2) NOT NULL DEFAULT 'GB',
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  postal_code TEXT,
  contact_email TEXT NOT NULL,
  contact_name TEXT,
  subscription_tier subscription_tier NOT NULL DEFAULT 'free_trial',
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  trial_ends_at TIMESTAMPTZ,
  formula_limit INT NOT NULL DEFAULT 5,
  market_limit INT NOT NULL DEFAULT 2,
  target_markets TEXT[] NOT NULL DEFAULT ARRAY['EU', 'UK'],
  settings JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tenants_slug ON tenants(slug);
CREATE INDEX idx_tenants_stripe ON tenants(stripe_customer_id);

-- ============================================
-- USERS (Team Members)
-- ============================================

CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'member', -- owner, admin, member, viewer
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_tenant ON users(tenant_id);

-- ============================================
-- INGREDIENTS (Global, shared across tenants)
-- ============================================

CREATE TABLE ingredients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cas_number TEXT UNIQUE NOT NULL,
  ec_number TEXT,
  inci_name TEXT NOT NULL,
  common_names TEXT[] NOT NULL DEFAULT '{}',
  molecular_formula TEXT,
  molecular_weight NUMERIC,
  is_ncs BOOLEAN NOT NULL DEFAULT FALSE, -- Natural Complex Substance
  ncs_source TEXT, -- e.g., "Lavandula angustifolia"
  description TEXT,
  pubchem_cid TEXT,
  
  -- IFRA Status
  ifra_status ifra_status NOT NULL DEFAULT 'no_restriction',
  ifra_amendment TEXT, -- e.g., "50th"
  ifra_limits JSONB NOT NULL DEFAULT '{}',
  -- Format: { "1": 0.5, "2": 1.0, "4": 5.0, "5A": 2.5, ... }
  
  -- CLP Classification
  clp_hazard_classes JSONB NOT NULL DEFAULT '{}',
  clp_hazard_statements TEXT[] NOT NULL DEFAULT '{}', -- H-codes
  clp_precautionary_statements TEXT[] NOT NULL DEFAULT '{}', -- P-codes
  clp_pictograms TEXT[] NOT NULL DEFAULT '{}', -- GHS01-GHS09
  clp_signal_word TEXT, -- "Danger" or "Warning"
  clp_skin_sensitiser BOOLEAN NOT NULL DEFAULT FALSE,
  clp_source TEXT NOT NULL DEFAULT 'echa_harmonised', -- echa_harmonised | self_classified
  
  -- Allergen Status
  is_eu_allergen BOOLEAN NOT NULL DEFAULT FALSE,
  allergen_group TEXT,
  allergen_threshold_leave_on NUMERIC, -- e.g., 0.001 (0.001%)
  allergen_threshold_rinse_off NUMERIC, -- e.g., 0.01
  
  -- Cosmetic Regulation
  eu_annex_ii BOOLEAN NOT NULL DEFAULT FALSE, -- Prohibited
  eu_annex_ii_entry TEXT,
  eu_annex_ii_note TEXT,
  eu_annex_iii BOOLEAN NOT NULL DEFAULT FALSE, -- Restricted with conditions
  eu_annex_iii_conditions JSONB,
  eu_annex_iv BOOLEAN NOT NULL DEFAULT FALSE, -- Permitted colourants
  eu_annex_v BOOLEAN NOT NULL DEFAULT FALSE, -- Permitted preservatives
  eu_annex_vi BOOLEAN NOT NULL DEFAULT FALSE, -- Permitted UV filters
  is_cmr BOOLEAN NOT NULL DEFAULT FALSE, -- Carcinogenic, Mutagenic, Reprotoxic
  cmr_category TEXT,
  is_nanomaterial BOOLEAN NOT NULL DEFAULT FALSE,
  is_endocrine_disruptor BOOLEAN NOT NULL DEFAULT FALSE,
  
  -- REACH
  reach_status reach_status NOT NULL DEFAULT 'unknown',
  reach_registration_number TEXT,
  reach_tonnage_band TEXT,
  svhc_candidate_date DATE,
  annex_xiv_entry TEXT,
  annex_xiv_sunset_date DATE,
  annex_xvii_entry TEXT,
  annex_xvii_conditions TEXT,
  
  -- Transport
  un_number TEXT,
  transport_class TEXT,
  packing_group TEXT,
  flash_point NUMERIC,
  
  -- Additional Markets
  uk_status JSONB NOT NULL DEFAULT '{}',
  gcc_status JSONB NOT NULL DEFAULT '{}',
  us_fda_status JSONB NOT NULL DEFAULT '{}',
  japan_status JSONB NOT NULL DEFAULT '{}',
  korea_status JSONB NOT NULL DEFAULT '{}',
  canada_status JSONB NOT NULL DEFAULT '{}',
  prop65_listed BOOLEAN NOT NULL DEFAULT FALSE,
  prop65_substance TEXT,
  
  -- Vector embedding for AI search
  embedding VECTOR(1536),
  
  -- Metadata
  data_sources TEXT[] NOT NULL DEFAULT '{}',
  last_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ingredients_cas ON ingredients(cas_number);
CREATE INDEX idx_ingredients_inci ON ingredients USING gin(inci_name gin_trgm_ops);
CREATE INDEX idx_ingredients_common ON ingredients USING gin(common_names);
CREATE INDEX idx_ingredients_allergen ON ingredients(is_eu_allergen) WHERE is_eu_allergen = TRUE;
CREATE INDEX idx_ingredients_annex_ii ON ingredients(eu_annex_ii) WHERE eu_annex_ii = TRUE;
CREATE INDEX idx_ingredients_ifra ON ingredients(ifra_status);
CREATE INDEX idx_ingredients_embedding ON ingredients USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- ============================================
-- NCS CONSTITUENTS
-- ============================================

CREATE TABLE ncs_constituents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parent_ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  constituent_cas TEXT NOT NULL,
  constituent_name TEXT NOT NULL,
  typical_pct_min NUMERIC NOT NULL,
  typical_pct_max NUMERIC NOT NULL,
  is_allergen BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ncs_parent ON ncs_constituents(parent_ingredient_id);
CREATE INDEX idx_ncs_cas ON ncs_constituents(constituent_cas);

-- ============================================
-- FORMULAS
-- ============================================

CREATE TABLE formulas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  external_id TEXT, -- Customer's internal formula ID
  name TEXT NOT NULL,
  version TEXT NOT NULL DEFAULT '1.0',
  version_number INT NOT NULL DEFAULT 1,
  product_category TEXT NOT NULL, -- IFRA category: "1", "4", "5A", etc.
  product_category_name TEXT,
  dosage_level NUMERIC NOT NULL, -- % in finished product
  intended_use TEXT,
  target_markets TEXT[] NOT NULL DEFAULT ARRAY['EU'],
  
  -- Compliance State
  compliance_status compliance_status NOT NULL DEFAULT 'pending',
  last_checked_at TIMESTAMPTZ,
  next_check_due TIMESTAMPTZ,
  
  -- Metadata
  notes TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_formulas_tenant ON formulas(tenant_id);
CREATE INDEX idx_formulas_status ON formulas(compliance_status);
CREATE INDEX idx_formulas_markets ON formulas USING gin(target_markets);

-- ============================================
-- FORMULA INGREDIENTS
-- ============================================

CREATE TABLE formula_ingredients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  formula_id UUID NOT NULL REFERENCES formulas(id) ON DELETE CASCADE,
  ingredient_id UUID NOT NULL REFERENCES ingredients(id),
  cas_number TEXT NOT NULL,
  ingredient_name TEXT NOT NULL, -- Denormalized for performance
  concentration_percent NUMERIC NOT NULL,
  function TEXT, -- top_note, heart_note, base_note, fixative, solvent, other
  supplier TEXT,
  supplier_grade TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_fi_formula ON formula_ingredients(formula_id);
CREATE INDEX idx_fi_ingredient ON formula_ingredients(ingredient_id);
CREATE INDEX idx_fi_cas ON formula_ingredients(cas_number);

-- Ensure no duplicate CAS in same formula
CREATE UNIQUE INDEX idx_fi_unique ON formula_ingredients(formula_id, cas_number);

-- ============================================
-- COMPLIANCE RESULTS
-- ============================================

CREATE TABLE compliance_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  formula_id UUID NOT NULL REFERENCES formulas(id) ON DELETE CASCADE,
  market_code TEXT NOT NULL,
  checkpoint TEXT NOT NULL, -- ingredient_id, ifra, clp, pcn, cosmetic_reg, allergens, reach, labelling, transport
  status compliance_status NOT NULL,
  message TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '[]',
  assessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cr_formula ON compliance_results(formula_id);
CREATE INDEX idx_cr_formula_market ON compliance_results(formula_id, market_code);
CREATE INDEX idx_cr_status ON compliance_results(status) WHERE status IN ('warn', 'fail');

-- ============================================
-- GENERATED DOCUMENTS
-- ============================================

CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  formula_id UUID NOT NULL REFERENCES formulas(id) ON DELETE CASCADE,
  document_type document_type NOT NULL,
  market_code TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'en',
  version INT NOT NULL DEFAULT 1,
  file_path TEXT, -- Supabase Storage path
  file_size INT,
  metadata JSONB NOT NULL DEFAULT '{}',
  -- For SDS: section data, for PCN: UFI code, for labels: INCI list
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ -- Some docs need periodic regeneration
);

CREATE INDEX idx_docs_formula ON documents(formula_id);
CREATE INDEX idx_docs_tenant ON documents(tenant_id);

-- ============================================
-- FORMULA VERSIONS (Audit Trail)
-- ============================================

CREATE TABLE formula_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  formula_id UUID NOT NULL REFERENCES formulas(id) ON DELETE CASCADE,
  version_number INT NOT NULL,
  version_label TEXT,
  change_summary TEXT,
  snapshot JSONB NOT NULL, -- Full formula state at this version
  compliance_snapshot JSONB, -- Compliance state at this version
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_fv_formula ON formula_versions(formula_id);

-- ============================================
-- ALERTS
-- ============================================

CREATE TABLE alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE, -- NULL = global alert
  alert_type alert_type NOT NULL,
  severity alert_severity NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}',
  affected_formula_ids UUID[] NOT NULL DEFAULT '{}',
  affected_ingredient_cas TEXT[],
  regulation_reference TEXT,
  action_required BOOLEAN NOT NULL DEFAULT FALSE,
  action_deadline TIMESTAMPTZ,
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_alerts_tenant ON alerts(tenant_id);
CREATE INDEX idx_alerts_severity ON alerts(severity);
CREATE INDEX idx_alerts_unacked ON alerts(tenant_id) WHERE acknowledged_at IS NULL;

-- ============================================
-- REGULATORY CHANGES (Monitoring Agent)
-- ============================================

CREATE TABLE regulatory_changes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source TEXT NOT NULL, -- ifra, echa, eu_oj, uk_opss, sfda, fda
  regulation TEXT NOT NULL,
  change_type TEXT NOT NULL, -- new_restriction, amendment, ban, relaxation, labelling_change
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  affected_substances TEXT[], -- CAS numbers
  effective_date DATE,
  transition_deadline DATE,
  source_url TEXT,
  raw_content TEXT,
  parsed_rules JSONB,
  impact_analysis JSONB, -- How many tenants/formulas affected
  published_content_id UUID, -- Link to blog post if content agent published
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  reviewed_by TEXT -- alfred or auto
);

CREATE INDEX idx_rc_source ON regulatory_changes(source);
CREATE INDEX idx_rc_substances ON regulatory_changes USING gin(affected_substances);

-- ============================================
-- LEADS (Sales Agent)
-- ============================================

CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_name TEXT NOT NULL,
  contact_name TEXT,
  contact_email TEXT,
  contact_linkedin TEXT,
  company_website TEXT,
  company_size TEXT, -- indie, mid, enterprise
  markets TEXT[],
  source TEXT NOT NULL, -- companies_house, linkedin, trade_pub, cpnp, inbound, referral
  source_detail TEXT,
  status lead_status NOT NULL DEFAULT 'identified',
  score INT NOT NULL DEFAULT 0,
  qualification_notes TEXT,
  outreach_sequence JSONB NOT NULL DEFAULT '[]',
  -- [{ "day": 0, "type": "email", "sent_at": "...", "opened": true, "clicked": false }]
  last_contacted_at TIMESTAMPTZ,
  converted_tenant_id UUID REFERENCES tenants(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_score ON leads(score DESC);

-- ============================================
-- SUPPORT TICKETS
-- ============================================

CREATE TABLE support_tickets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  category TEXT NOT NULL, -- technical, regulatory, account, bug, complaint
  subject TEXT NOT NULL,
  messages JSONB NOT NULL DEFAULT '[]',
  -- [{ "role": "user"|"agent"|"alfred", "content": "...", "timestamp": "..." }]
  status TEXT NOT NULL DEFAULT 'open', -- open, in_progress, resolved, escalated
  priority TEXT NOT NULL DEFAULT 'normal', -- low, normal, high, urgent
  satisfaction_score INT, -- 1-5
  resolved_at TIMESTAMPTZ,
  escalated_to TEXT, -- complaints_agent, alfred
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tickets_tenant ON support_tickets(tenant_id);
CREATE INDEX idx_tickets_status ON support_tickets(status) WHERE status != 'resolved';

-- ============================================
-- AGENT EVENT BUS
-- ============================================

CREATE TABLE agent_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type agent_event_type NOT NULL,
  payload JSONB NOT NULL,
  source_agent TEXT NOT NULL,
  target_agents TEXT[],
  processed_by TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX idx_events_type ON agent_events(event_type);
CREATE INDEX idx_events_pending ON agent_events(status) WHERE status = 'pending';
CREATE INDEX idx_events_created ON agent_events(created_at DESC);

-- ============================================
-- AGENT RUNS (Observability)
-- ============================================

CREATE TABLE agent_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_name TEXT NOT NULL,
  trigger_type TEXT NOT NULL, -- scheduled, event, manual
  trigger_event_id UUID REFERENCES agent_events(id),
  status TEXT NOT NULL DEFAULT 'running', -- running, completed, failed, escalated
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  duration_ms INT,
  actions_taken JSONB NOT NULL DEFAULT '[]',
  tokens_used INT NOT NULL DEFAULT 0,
  cost_usd NUMERIC NOT NULL DEFAULT 0,
  error TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX idx_runs_agent ON agent_runs(agent_name);
CREATE INDEX idx_runs_status ON agent_runs(status) WHERE status = 'running';

-- ============================================
-- CONTENT (Marketing Agent)
-- ============================================

CREATE TABLE content_posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  content_type TEXT NOT NULL, -- blog, linkedin, newsletter, social
  body TEXT NOT NULL,
  excerpt TEXT,
  seo_title TEXT,
  seo_description TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  related_regulatory_change_id UUID REFERENCES regulatory_changes(id),
  status TEXT NOT NULL DEFAULT 'draft', -- draft, scheduled, published
  published_at TIMESTAMPTZ,
  scheduled_for TIMESTAMPTZ,
  platform_post_ids JSONB NOT NULL DEFAULT '{}',
  -- { "linkedin": "post_id", "blog": "url" }
  performance JSONB NOT NULL DEFAULT '{}',
  -- { "views": 0, "clicks": 0, "conversions": 0 }
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_content_status ON content_posts(status);
CREATE INDEX idx_content_published ON content_posts(published_at DESC);

-- ============================================
-- BILLING EVENTS
-- ============================================

CREATE TABLE billing_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- payment_succeeded, payment_failed, subscription_created, subscription_cancelled, refund
  stripe_event_id TEXT,
  amount_cents INT,
  currency TEXT DEFAULT 'gbp',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_billing_tenant ON billing_events(tenant_id);

-- ============================================
-- USAGE TRACKING
-- ============================================

CREATE TABLE usage_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  formulas_checked INT NOT NULL DEFAULT 0,
  documents_generated INT NOT NULL DEFAULT 0,
  api_calls INT NOT NULL DEFAULT 0,
  support_tickets INT NOT NULL DEFAULT 0,
  alerts_generated INT NOT NULL DEFAULT 0,
  ai_tokens_used INT NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX idx_usage_tenant_period ON usage_records(tenant_id, period_start);

-- ============================================
-- WEBHOOKS (Integration)
-- ============================================

CREATE TABLE webhooks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  secret TEXT NOT NULL,
  events TEXT[] NOT NULL, -- regulation_changed, formula_noncompliant, document_generated
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_delivery_at TIMESTAMPTZ,
  last_delivery_status INT,
  failure_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_webhooks_tenant ON webhooks(tenant_id);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE formulas ENABLE ROW LEVEL SECURITY;
ALTER TABLE formula_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhooks ENABLE ROW LEVEL SECURITY;

-- Tenant isolation: users can only see their own tenant's data
CREATE POLICY tenant_isolation_tenants ON tenants
  FOR ALL USING (
    id IN (SELECT tenant_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY tenant_isolation_formulas ON formulas
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY tenant_isolation_fi ON formula_ingredients
  FOR ALL USING (
    formula_id IN (
      SELECT f.id FROM formulas f
      JOIN users u ON u.tenant_id = f.tenant_id
      WHERE u.id = auth.uid()
    )
  );

CREATE POLICY tenant_isolation_cr ON compliance_results
  FOR ALL USING (
    formula_id IN (
      SELECT f.id FROM formulas f
      JOIN users u ON u.tenant_id = f.tenant_id
      WHERE u.id = auth.uid()
    )
  );

CREATE POLICY tenant_isolation_docs ON documents
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY tenant_isolation_alerts ON alerts
  FOR ALL USING (
    tenant_id IS NULL OR
    tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY tenant_isolation_tickets ON support_tickets
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY tenant_isolation_billing ON billing_events
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY tenant_isolation_usage ON usage_records
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY tenant_isolation_webhooks ON webhooks
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid())
  );

-- Ingredients are globally readable
ALTER TABLE ingredients ENABLE ROW LEVEL SECURITY;
CREATE POLICY ingredients_read ON ingredients FOR SELECT USING (true);

ALTER TABLE ncs_constituents ENABLE ROW LEVEL SECURITY;
CREATE POLICY ncs_read ON ncs_constituents FOR SELECT USING (true);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tenants_updated_at BEFORE UPDATE ON tenants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER formulas_updated_at BEFORE UPDATE ON formulas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER leads_updated_at BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tickets_updated_at BEFORE UPDATE ON support_tickets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Function to create formula version snapshot on update
CREATE OR REPLACE FUNCTION create_formula_version()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.version_number != NEW.version_number THEN
    INSERT INTO formula_versions (formula_id, version_number, version_label, snapshot)
    VALUES (
      OLD.id,
      OLD.version_number,
      OLD.version,
      jsonb_build_object(
        'name', OLD.name,
        'version', OLD.version,
        'product_category', OLD.product_category,
        'dosage_level', OLD.dosage_level,
        'target_markets', OLD.target_markets
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER formula_version_trigger BEFORE UPDATE ON formulas
  FOR EACH ROW EXECUTE FUNCTION create_formula_version();

-- Function to emit agent event on new formula
CREATE OR REPLACE FUNCTION emit_formula_event()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO agent_events (event_type, payload, source_agent)
  VALUES (
    CASE WHEN TG_OP = 'INSERT' THEN 'formula_created'::agent_event_type
         ELSE 'formula_updated'::agent_event_type END,
    jsonb_build_object('formula_id', NEW.id, 'tenant_id', NEW.tenant_id, 'name', NEW.name),
    'system'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER formula_event_trigger AFTER INSERT OR UPDATE ON formulas
  FOR EACH ROW EXECUTE FUNCTION emit_formula_event();

-- Notify on new agent events (for real-time processing)
CREATE OR REPLACE FUNCTION notify_agent_event()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM pg_notify('agent_events', json_build_object(
    'id', NEW.id,
    'event_type', NEW.event_type,
    'source_agent', NEW.source_agent
  )::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER agent_event_notify AFTER INSERT ON agent_events
  FOR EACH ROW EXECUTE FUNCTION notify_agent_event();
