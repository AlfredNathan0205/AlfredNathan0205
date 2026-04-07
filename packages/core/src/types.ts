// ============================================
// SCENTSHIELD CORE — Domain Types
// ============================================

// --- Database Row Types ---

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  vat_number: string | null;
  country_code: string;
  contact_email: string;
  contact_name: string | null;
  subscription_tier: SubscriptionTier;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  trial_ends_at: string | null;
  formula_limit: number;
  market_limit: number;
  target_markets: string[];
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export type SubscriptionTier = 'free_trial' | 'indie' | 'professional' | 'enterprise';
export type ComplianceStatus = 'pass' | 'warn' | 'fail' | 'na' | 'pending';
export type IFRAStatus = 'no_restriction' | 'restriction' | 'specification' | 'prohibition';
export type REACHStatus = 'registered' | 'pre_registered' | 'exempt' | 'svhc_candidate' | 'authorisation_list' | 'restricted' | 'unknown';
export type DocumentType = 'sds' | 'label' | 'pcn' | 'cpnp' | 'cpsr_part_a' | 'cpsr_part_b' | 'transport' | 'scip';
export type AlertSeverity = 'info' | 'warning' | 'critical';
export type AlertType = 'regulatory_change' | 'formula_noncompliant' | 'pcn_update_required' | 'deadline_approaching' | 'allergen_update' | 'system';

export interface Ingredient {
  id: string;
  cas_number: string;
  ec_number: string | null;
  inci_name: string;
  common_names: string[];
  is_ncs: boolean;
  ifra_status: IFRAStatus;
  ifra_limits: Record<string, number>; // category → max %
  clp_hazard_statements: string[];
  clp_precautionary_statements: string[];
  clp_pictograms: string[];
  clp_signal_word: string | null;
  clp_skin_sensitiser: boolean;
  is_eu_allergen: boolean;
  allergen_threshold_leave_on: number | null;
  allergen_threshold_rinse_off: number | null;
  eu_annex_ii: boolean;
  eu_annex_ii_note: string | null;
  eu_annex_iii: boolean;
  eu_annex_iii_conditions: Record<string, unknown> | null;
  reach_status: REACHStatus;
  prop65_listed: boolean;
}

export interface NCSConstituent {
  id: string;
  parent_ingredient_id: string;
  constituent_cas: string;
  constituent_name: string;
  typical_pct_min: number;
  typical_pct_max: number;
  is_allergen: boolean;
}

export interface Formula {
  id: string;
  tenant_id: string;
  external_id: string | null;
  name: string;
  version: string;
  version_number: number;
  product_category: string;
  dosage_level: number;
  target_markets: string[];
  compliance_status: ComplianceStatus;
  last_checked_at: string | null;
  ingredients?: FormulaIngredient[];
}

export interface FormulaIngredient {
  id: string;
  formula_id: string;
  ingredient_id: string;
  cas_number: string;
  ingredient_name: string;
  concentration_percent: number;
  function: string | null;
}

// --- Compliance Engine Types ---

export interface CheckpointResult {
  status: ComplianceStatus;
  message: string;
  details: CheckpointDetail[];
}

export interface CheckpointDetail {
  severity: 'fail' | 'warn' | 'info';
  substance: string;
  cas?: string;
  message: string;
  data?: Record<string, unknown>;
}

export interface MarketComplianceResult {
  market_code: string;
  market_name: string;
  overall: ComplianceStatus;
  checkpoints: {
    ingredient_id: CheckpointResult;
    ifra: CheckpointResult;
    clp: CheckpointResult;
    pcn: CheckpointResult;
    cosmetic_reg: CheckpointResult;
    allergens: CheckpointResult;
    reach: CheckpointResult;
    labelling: CheckpointResult;
    transport: CheckpointResult;
  };
}

export interface FormulaComplianceResult {
  formula_id: string;
  checked_at: string;
  markets: Record<string, MarketComplianceResult>;
  overall: ComplianceStatus;
}

// --- API Types ---

export interface FormulaCheckRequest {
  external_id?: string;
  name: string;
  product_category: string;
  dosage_level: number;
  markets: string[];
  ingredients: {
    cas_number: string;
    name?: string;
    concentration_percent: number;
    function?: string;
  }[];
}

export interface FormulaCheckResponse {
  formula_id: string;
  compliance: FormulaComplianceResult;
  documents_available: DocumentType[];
}

// --- Agent Types ---

export type AgentEventType =
  | 'regulation_changed' | 'formula_created' | 'formula_updated' | 'formula_noncompliant'
  | 'customer_signed_up' | 'customer_churning' | 'payment_failed' | 'payment_succeeded'
  | 'support_ticket_created' | 'content_scheduled' | 'lead_identified'
  | 'complaint_received' | 'document_generated' | 'trial_expiring';

export interface AgentEvent {
  id: string;
  event_type: AgentEventType;
  payload: Record<string, unknown>;
  source_agent: string;
  target_agents?: string[];
  created_at: string;
}

export interface AgentRunResult {
  agent_name: string;
  status: 'completed' | 'failed' | 'escalated';
  actions_taken: string[];
  tokens_used: number;
  duration_ms: number;
  error?: string;
}

// --- Market Configuration ---

export interface MarketConfig {
  code: string;
  name: string;
  flag: string;
  regulations: string[];
  labelling_languages: string[];
}

export const MARKETS: MarketConfig[] = [
  { code: 'EU', name: 'European Union', flag: '🇪🇺', regulations: ['IFRA', 'CLP', 'PCN', 'EU1223', 'ALLERGEN_EU', 'REACH'], labelling_languages: ['en', 'fr', 'de', 'es', 'it', 'nl', 'pt', 'pl'] },
  { code: 'UK', name: 'United Kingdom', flag: '🇬🇧', regulations: ['IFRA', 'CLP', 'PCN', 'UK_COSREG', 'ALLERGEN_EU', 'UK_REACH'], labelling_languages: ['en'] },
  { code: 'GCC', name: 'Gulf States (GCC)', flag: '🇸🇦', regulations: ['IFRA', 'GSO', 'SFDA'], labelling_languages: ['ar', 'en'] },
  { code: 'US', name: 'United States', flag: '🇺🇸', regulations: ['IFRA', 'FDA_COSM', 'PROP65'], labelling_languages: ['en'] },
  { code: 'JP', name: 'Japan', flag: '🇯🇵', regulations: ['IFRA', 'MHLW'], labelling_languages: ['ja'] },
  { code: 'KR', name: 'South Korea', flag: '🇰🇷', regulations: ['IFRA', 'MFDS'], labelling_languages: ['ko'] },
  { code: 'CA', name: 'Canada', flag: '🇨🇦', regulations: ['IFRA', 'HEALTH_CANADA'], labelling_languages: ['en', 'fr'] },
];

export const IFRA_CATEGORIES: Record<string, string> = {
  '1': 'Lip Products', '2': 'Deodorant/Antiperspirant', '3': 'Hydroalcoholic Face',
  '4': 'Fine Fragrance', '5A': 'Body Lotion', '5B': 'Face Cream', '5C': 'Hand Cream',
  '5D': 'Baby Products', '6': 'Oral Products', '7A': 'Rinse-off Hair', '7B': 'Leave-on Hair',
  '8': 'Intimate Wipes', '9': 'Rinse-off (Soap/Shower)', '10A': 'Household Cleaning',
  '10B': 'Air Freshener/Candle', '11A': 'Toys', '11B': 'Other',
};
