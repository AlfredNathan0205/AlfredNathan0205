// ============================================
// SCENTSHIELD — Regulatory Monitoring Agent
// Watches for regulatory changes, assesses impact
// ============================================

import { getSupabase } from '../../shared/src/db';
import { askClaude, askClaudeJSON } from '../../shared/src/claude';
import { emitEvent, logAgentRun } from '../../shared/src/events';
import { sendAlertEmail } from '../../shared/src/email';

const AGENT_NAME = 'monitoring';

// --- Regulatory Sources ---

interface RegulatorySource {
  name: string;
  id: string;
  urls: string[];
  checkFn: () => Promise<RegulatoryChange[]>;
}

interface RegulatoryChange {
  source: string;
  regulation: string;
  changeType: 'new_restriction' | 'amendment' | 'ban' | 'relaxation' | 'labelling_change';
  title: string;
  summary: string;
  affectedSubstances: string[]; // CAS numbers
  effectiveDate?: string;
  transitionDeadline?: string;
  sourceUrl?: string;
  rawContent?: string;
}

// --- Source Checkers ---

async function checkIFRA(): Promise<RegulatoryChange[]> {
  // In production: scrape https://ifrafragrance.org/safe-use/library
  // For MVP: poll a known endpoint or RSS feed
  // Parse amendments, extract affected substances and new limits

  // Placeholder — replace with actual scraping logic
  console.log(`[${AGENT_NAME}] Checking IFRA for updates...`);

  // Example of how scraping would work:
  // const response = await fetch('https://ifrafragrance.org/safe-use/library');
  // const html = await response.text();
  // const changes = await askClaudeJSON<RegulatoryChange[]>(
  //   `Parse this IFRA library page and identify any new amendments or standards changes since [last_check_date]:\n${html}`,
  //   { system: 'You are an IFRA regulatory analyst. Extract structured change data.' }
  // );

  return [];
}

async function checkECHA(): Promise<RegulatoryChange[]> {
  // In production: check ECHA RSS feeds and data downloads
  // - https://echa.europa.eu/candidate-list-table (SVHC)
  // - https://echa.europa.eu/substances-restricted-under-reach
  // - https://echa.europa.eu/information-on-chemicals/cl-inventory-database

  console.log(`[${AGENT_NAME}] Checking ECHA for updates...`);
  return [];
}

async function checkEUOfficialJournal(): Promise<RegulatoryChange[]> {
  // In production: monitor EUR-Lex for cosmetic regulation amendments
  // https://eur-lex.europa.eu/search.html?type=named&name=oj

  console.log(`[${AGENT_NAME}] Checking EU Official Journal...`);
  return [];
}

async function checkUKOPSS(): Promise<RegulatoryChange[]> {
  // UK Office for Product Safety and Standards
  // Monitor for UK-specific divergences from EU regulations

  console.log(`[${AGENT_NAME}] Checking UK OPSS...`);
  return [];
}

async function checkSFDA(): Promise<RegulatoryChange[]> {
  // Saudi Food and Drug Authority
  // Monitor for GCC cosmetic regulation changes

  console.log(`[${AGENT_NAME}] Checking SFDA...`);
  return [];
}

const SOURCES: RegulatorySource[] = [
  { name: 'IFRA', id: 'ifra', urls: ['https://ifrafragrance.org/safe-use/library'], checkFn: checkIFRA },
  { name: 'ECHA', id: 'echa', urls: ['https://echa.europa.eu'], checkFn: checkECHA },
  { name: 'EU Official Journal', id: 'eu_oj', urls: ['https://eur-lex.europa.eu'], checkFn: checkEUOfficialJournal },
  { name: 'UK OPSS', id: 'uk_opss', urls: ['https://www.gov.uk/government/organisations/office-for-product-safety-and-standards'], checkFn: checkUKOPSS },
  { name: 'SFDA', id: 'sfda', urls: ['https://www.sfda.gov.sa'], checkFn: checkSFDA },
];

// --- Impact Analysis ---

async function analyseImpact(change: RegulatoryChange): Promise<{
  affectedTenants: { tenantId: string; formulaIds: string[]; email: string }[];
  totalFormulasAffected: number;
}> {
  const db = getSupabase();

  if (change.affectedSubstances.length === 0) {
    return { affectedTenants: [], totalFormulasAffected: 0 };
  }

  // Find all formulas using affected substances
  const { data: affectedIngredients } = await db
    .from('formula_ingredients')
    .select('formula_id, cas_number, formulas(id, name, tenant_id, tenants(id, contact_email))')
    .in('cas_number', change.affectedSubstances);

  if (!affectedIngredients?.length) {
    return { affectedTenants: [], totalFormulasAffected: 0 };
  }

  // Group by tenant
  const tenantMap = new Map<string, { formulaIds: Set<string>; email: string }>();
  for (const fi of affectedIngredients) {
    const formula = fi.formulas as any;
    const tenant = formula?.tenants as any;
    if (!tenant) continue;

    if (!tenantMap.has(tenant.id)) {
      tenantMap.set(tenant.id, { formulaIds: new Set(), email: tenant.contact_email });
    }
    tenantMap.get(tenant.id)!.formulaIds.add(formula.id);
  }

  return {
    affectedTenants: [...tenantMap.entries()].map(([tenantId, { formulaIds, email }]) => ({
      tenantId,
      formulaIds: [...formulaIds],
      email,
    })),
    totalFormulasAffected: new Set(affectedIngredients.map(fi => fi.formula_id)).size,
  };
}

// --- Alert Generation ---

async function createAlerts(change: RegulatoryChange, impact: Awaited<ReturnType<typeof analyseImpact>>): Promise<void> {
  const db = getSupabase();

  for (const tenant of impact.affectedTenants) {
    // Create database alert
    await db.from('alerts').insert({
      tenant_id: tenant.tenantId,
      alert_type: 'regulatory_change',
      severity: change.changeType === 'ban' ? 'critical' : 'warning',
      title: change.title,
      message: change.summary,
      details: {
        source: change.source,
        affectedSubstances: change.affectedSubstances,
        effectiveDate: change.effectiveDate,
        transitionDeadline: change.transitionDeadline,
        sourceUrl: change.sourceUrl,
      },
      affected_formula_ids: tenant.formulaIds,
      affected_ingredient_cas: change.affectedSubstances,
      regulation_reference: change.regulation,
      action_required: true,
      action_deadline: change.transitionDeadline,
    });

    // Send email alert
    await sendAlertEmail(
      tenant.email,
      change.title,
      `${change.summary}\n\nAffected formulas: ${tenant.formulaIds.length}. Log in to ScentShield to review impact and take action.`,
      change.changeType === 'ban' ? 'critical' : 'warning',
    );
  }

  // Emit events for other agents
  await emitEvent('regulation_changed', {
    changeId: change.title,
    source: change.source,
    affectedSubstances: change.affectedSubstances,
    totalFormulasAffected: impact.totalFormulasAffected,
  }, AGENT_NAME, ['content', 'sales']);
}

// --- Main Run ---

export async function runMonitoringCycle(): Promise<void> {
  const run = await logAgentRun(AGENT_NAME, 'scheduled');
  const actions: string[] = [];
  let tokensUsed = 0;

  try {
    const allChanges: RegulatoryChange[] = [];

    for (const source of SOURCES) {
      try {
        const changes = await source.checkFn();
        allChanges.push(...changes);
        actions.push(`Checked ${source.name}: ${changes.length} changes`);
      } catch (err) {
        console.error(`[${AGENT_NAME}] Error checking ${source.name}:`, err);
        actions.push(`Error checking ${source.name}`);
      }
    }

    // Store and process each change
    const db = getSupabase();
    for (const change of allChanges) {
      // Store the change
      await db.from('regulatory_changes').insert({
        source: change.source,
        regulation: change.regulation,
        change_type: change.changeType,
        title: change.title,
        summary: change.summary,
        affected_substances: change.affectedSubstances,
        effective_date: change.effectiveDate,
        transition_deadline: change.transitionDeadline,
        source_url: change.sourceUrl,
        raw_content: change.rawContent,
      });

      // Analyse impact
      const impact = await analyseImpact(change);
      actions.push(`Impact analysis: ${impact.totalFormulasAffected} formulas affected`);

      // Create alerts
      if (impact.totalFormulasAffected > 0) {
        await createAlerts(change, impact);
        actions.push(`Created alerts for ${impact.affectedTenants.length} tenants`);
      }
    }

    await run.complete({ actions, tokensUsed });
    console.log(`[${AGENT_NAME}] Cycle complete: ${allChanges.length} changes, ${actions.length} actions`);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    await run.complete({ actions, tokensUsed, error });
    throw err;
  }
}
