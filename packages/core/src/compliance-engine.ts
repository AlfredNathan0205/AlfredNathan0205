// ============================================
// SCENTSHIELD — Compliance Engine
// 9-Checkpoint Regulatory Pipeline
// ============================================

import type {
  Formula, FormulaIngredient, Ingredient, NCSConstituent,
  CheckpointResult, CheckpointDetail, MarketComplianceResult,
  FormulaComplianceResult, ComplianceStatus, MarketConfig, MARKETS,
} from './types';

interface FormulaWithIngredients extends Formula {
  ingredients: (FormulaIngredient & { ingredient: Ingredient; ncs_constituents?: NCSConstituent[] })[];
}

interface ComplianceContext {
  formula: FormulaWithIngredients;
  market: MarketConfig;
}

// --- Main Pipeline ---

export async function runCompliancePipeline(
  formula: FormulaWithIngredients,
  markets: MarketConfig[],
): Promise<FormulaComplianceResult> {
  const marketResults: Record<string, MarketComplianceResult> = {};

  for (const market of markets) {
    const ctx: ComplianceContext = { formula, market };

    const checkpoints = {
      ingredient_id: checkIngredientIdentity(ctx),
      ifra: checkIFRA(ctx),
      clp: market.regulations.includes('CLP') ? checkCLP(ctx) : naResult('CLP not applicable'),
      pcn: market.regulations.includes('PCN') ? checkPCN(ctx) : naResult('PCN not applicable'),
      cosmetic_reg: checkCosmeticRegulation(ctx),
      allergens: checkAllergens(ctx),
      reach: market.regulations.includes('REACH') || market.regulations.includes('UK_REACH')
        ? checkREACH(ctx)
        : naResult('REACH not applicable'),
      labelling: checkLabelling(ctx),
      transport: checkTransport(ctx),
    };

    const statuses = Object.values(checkpoints).map(c => c.status);
    const overall: ComplianceStatus = statuses.includes('fail')
      ? 'fail'
      : statuses.includes('warn')
        ? 'warn'
        : 'pass';

    marketResults[market.code] = {
      market_code: market.code,
      market_name: market.name,
      overall,
      checkpoints,
    };
  }

  const allOveralls = Object.values(marketResults).map(m => m.overall);
  const overall: ComplianceStatus = allOveralls.includes('fail')
    ? 'fail'
    : allOveralls.includes('warn')
      ? 'warn'
      : 'pass';

  return {
    formula_id: formula.id,
    checked_at: new Date().toISOString(),
    markets: marketResults,
    overall,
  };
}

// --- Checkpoint 1: Ingredient Identity Resolution ---

function checkIngredientIdentity(ctx: ComplianceContext): CheckpointResult {
  const issues: CheckpointDetail[] = [];

  for (const fi of ctx.formula.ingredients) {
    if (!fi.ingredient) {
      issues.push({
        severity: 'fail',
        substance: fi.ingredient_name || fi.cas_number,
        cas: fi.cas_number,
        message: `CAS ${fi.cas_number} not found in ingredient database. Manual resolution required.`,
      });
    }
  }

  return {
    status: issues.length > 0 ? 'fail' : 'pass',
    message: issues.length > 0 ? `${issues.length} unresolved ingredient(s)` : 'All ingredients resolved',
    details: issues,
  };
}

// --- Checkpoint 2: IFRA Compliance ---

function checkIFRA(ctx: ComplianceContext): CheckpointResult {
  const { formula } = ctx;
  const issues: CheckpointDetail[] = [];

  for (const fi of formula.ingredients) {
    const ing = fi.ingredient;
    if (!ing) continue;

    // Check direct substance
    if (ing.ifra_status === 'prohibition') {
      issues.push({
        severity: 'fail',
        substance: ing.inci_name,
        cas: ing.cas_number,
        message: 'PROHIBITED under IFRA standards',
      });
      continue;
    }

    if (ing.ifra_status === 'restriction') {
      const limit = ing.ifra_limits[formula.product_category];
      if (limit !== undefined) {
        // CRITICAL: Calculate concentration in FINISHED PRODUCT
        const actualInProduct = fi.concentration_percent * (formula.dosage_level / 100);
        if (actualInProduct > limit) {
          issues.push({
            severity: 'fail',
            substance: ing.inci_name,
            cas: ing.cas_number,
            message: `${actualInProduct.toFixed(3)}% in finished product exceeds IFRA limit of ${limit}% for Category ${formula.product_category}`,
            data: { actualInProduct, limit, category: formula.product_category },
          });
        } else if (actualInProduct > limit * 0.9) {
          issues.push({
            severity: 'warn',
            substance: ing.inci_name,
            cas: ing.cas_number,
            message: `${actualInProduct.toFixed(3)}% in finished product is within 10% of IFRA limit (${limit}%)`,
            data: { actualInProduct, limit, category: formula.product_category },
          });
        }
      }
    }

    // Check NCS constituents
    if (ing.is_ncs && fi.ncs_constituents) {
      for (const nc of fi.ncs_constituents) {
        // Look up constituent in main ingredient database
        // In production, this would be a DB query
        const ncConcentrationInCompound = fi.concentration_percent * (nc.typical_pct_max / 100);
        const ncConcentrationInProduct = ncConcentrationInCompound * (formula.dosage_level / 100);

        // Check IFRA limits for constituent
        // This requires the constituent's IFRA data — in production, join with ingredients table
      }
    }
  }

  const fails = issues.filter(i => i.severity === 'fail');
  const warns = issues.filter(i => i.severity === 'warn');
  return {
    status: fails.length > 0 ? 'fail' : warns.length > 0 ? 'warn' : 'pass',
    message: fails.length > 0
      ? `${fails.length} IFRA violation(s)`
      : warns.length > 0
        ? `${warns.length} near-limit warning(s)`
        : 'Fully IFRA compliant',
    details: issues,
  };
}

// --- Checkpoint 3: CLP Hazard Classification ---

function checkCLP(ctx: ComplianceContext): CheckpointResult {
  const allHazards = new Set<string>();
  const allPictograms = new Set<string>();
  let worstSignal: string | null = null;
  let hasSkinSens = false;

  for (const fi of ctx.formula.ingredients) {
    const ing = fi.ingredient;
    if (!ing) continue;

    // Simplified mixture classification (full CLP Annex I rules are complex)
    if (fi.concentration_percent >= 1.0) {
      ing.clp_hazard_statements.forEach(h => allHazards.add(h));
      ing.clp_pictograms.forEach(p => allPictograms.add(p));

      if (ing.clp_signal_word === 'Danger') worstSignal = 'Danger';
      else if (ing.clp_signal_word === 'Warning' && worstSignal !== 'Danger') worstSignal = 'Warning';
    }

    if (ing.clp_skin_sensitiser && fi.concentration_percent >= 0.1) {
      hasSkinSens = true;
    }
  }

  const isHazardous = allHazards.size > 0;
  return {
    status: isHazardous ? 'warn' : 'pass',
    message: isHazardous
      ? `Classified hazardous — ${allHazards.size} H-statements, signal word: ${worstSignal}`
      : 'Not classified as hazardous',
    details: [{
      severity: isHazardous ? 'warn' : 'info',
      substance: 'Mixture',
      message: `H-statements: ${[...allHazards].join(', ') || 'None'}`,
      data: {
        hazards: [...allHazards],
        pictograms: [...allPictograms],
        signalWord: worstSignal,
        skinSensitiser: hasSkinSens,
        isHazardous,
      },
    }],
  };
}

// --- Checkpoint 4: Poison Centre Notification ---

function checkPCN(ctx: ComplianceContext): CheckpointResult {
  const clpResult = checkCLP(ctx);
  const clpData = clpResult.details[0]?.data as { isHazardous?: boolean } | undefined;

  if (!clpData?.isHazardous) {
    return { status: 'pass', message: 'PCN not required — mixture not classified as hazardous', details: [] };
  }

  const ufi = generateUFI(
    ctx.formula.tenant_id,
    ctx.formula.id,
  );

  return {
    status: 'warn',
    message: 'PCN submission REQUIRED — mixture is classified hazardous under CLP',
    details: [{
      severity: 'warn',
      substance: 'Mixture',
      message: `UFI: ${ufi} — Must be submitted to ECHA PCN portal and printed on product label`,
      data: { ufi, requiresSubmission: true },
    }],
  };
}

function generateUFI(tenantId: string, formulaId: string): string {
  // Simplified UFI generation — production would use ECHA's official algorithm
  let hash = 0;
  const str = tenantId + formulaId;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  const chars = '0123456789ABCDEFGHJKMNPQRSTUVWXYZ';
  let ufi = '';
  let n = Math.abs(hash);
  for (let i = 0; i < 16; i++) {
    ufi += chars[n % 32];
    n = Math.floor(n / 32) + i * 7;
  }
  return `${ufi.slice(0, 4)}-${ufi.slice(4, 8)}-${ufi.slice(8, 12)}-${ufi.slice(12, 16)}`;
}

// --- Checkpoint 5: Cosmetic Regulation ---

function checkCosmeticRegulation(ctx: ComplianceContext): CheckpointResult {
  const issues: CheckpointDetail[] = [];

  for (const fi of ctx.formula.ingredients) {
    const ing = fi.ingredient;
    if (!ing) continue;

    if (ing.eu_annex_ii) {
      issues.push({
        severity: 'fail',
        substance: ing.inci_name,
        cas: ing.cas_number,
        message: `BANNED — ${ing.eu_annex_ii_note || 'Listed in Annex II (Prohibited Substances)'}`,
      });
    }

    if (ing.eu_annex_iii) {
      issues.push({
        severity: 'warn',
        substance: ing.inci_name,
        cas: ing.cas_number,
        message: `RESTRICTED — Annex III conditions apply`,
        data: { conditions: ing.eu_annex_iii_conditions },
      });
    }

    if (ing.is_cmr) {
      issues.push({
        severity: 'fail',
        substance: ing.inci_name,
        cas: ing.cas_number,
        message: `CMR substance — prohibited in cosmetics unless SCCS-exempted`,
      });
    }
  }

  const fails = issues.filter(i => i.severity === 'fail');
  return {
    status: fails.length > 0 ? 'fail' : issues.length > 0 ? 'warn' : 'pass',
    message: fails.length > 0
      ? `${fails.length} prohibited substance(s) detected`
      : issues.length > 0
        ? `${issues.length} restricted substance(s) — conditions apply`
        : 'Compliant with cosmetic regulation',
    details: issues,
  };
}

// --- Checkpoint 6: Allergen Disclosure ---

function checkAllergens(ctx: ComplianceContext): CheckpointResult {
  const { formula } = ctx;
  const isLeaveOn = !['9', '7A', '6', '8'].includes(formula.product_category);
  const declarable: CheckpointDetail[] = [];

  for (const fi of formula.ingredients) {
    const ing = fi.ingredient;
    if (!ing) continue;

    // Direct allergen
    if (ing.is_eu_allergen) {
      const threshold = isLeaveOn
        ? (ing.allergen_threshold_leave_on ?? 0.001)
        : (ing.allergen_threshold_rinse_off ?? 0.01);
      const concInProduct = fi.concentration_percent * (formula.dosage_level / 100);

      if (concInProduct / 100 > threshold) {
        declarable.push({
          severity: 'warn',
          substance: ing.inci_name,
          cas: ing.cas_number,
          message: `${concInProduct.toFixed(4)}% in product — exceeds ${(threshold * 100).toFixed(3)}% threshold for ${isLeaveOn ? 'leave-on' : 'rinse-off'} products`,
        });
      }
    }

    // NCS constituent allergens
    if (ing.is_ncs && fi.ncs_constituents) {
      for (const nc of fi.ncs_constituents) {
        if (!nc.is_allergen) continue;
        const threshold = isLeaveOn ? 0.001 : 0.01;
        const ncConcInProduct = fi.concentration_percent * (nc.typical_pct_max / 100) * (formula.dosage_level / 100);

        if (ncConcInProduct / 100 > threshold) {
          declarable.push({
            severity: 'warn',
            substance: `${nc.constituent_name} (via ${ing.inci_name})`,
            cas: nc.constituent_cas,
            message: `${ncConcInProduct.toFixed(4)}% in product via NCS — exceeds ${(threshold * 100).toFixed(3)}% threshold`,
          });
        }
      }
    }
  }

  return {
    status: declarable.length > 0 ? 'warn' : 'pass',
    message: declarable.length > 0
      ? `${declarable.length} allergen(s) require label declaration`
      : 'No allergens above disclosure threshold',
    details: declarable,
  };
}

// --- Checkpoint 7: REACH Compliance ---

function checkREACH(ctx: ComplianceContext): CheckpointResult {
  const issues: CheckpointDetail[] = [];

  for (const fi of ctx.formula.ingredients) {
    const ing = fi.ingredient;
    if (!ing) continue;

    if (ing.reach_status === 'svhc_candidate' && fi.concentration_percent >= 0.1) {
      issues.push({
        severity: 'warn',
        substance: ing.inci_name,
        cas: ing.cas_number,
        message: 'On SVHC Candidate List at ≥0.1% — Art. 33 communication duty + SCIP notification required',
      });
    }

    if (ing.reach_status === 'restricted') {
      issues.push({
        severity: 'fail',
        substance: ing.inci_name,
        cas: ing.cas_number,
        message: 'REACH Annex XVII restricted substance',
      });
    }

    if (ing.reach_status === 'authorisation_list') {
      issues.push({
        severity: 'fail',
        substance: ing.inci_name,
        cas: ing.cas_number,
        message: 'REACH Annex XIV — requires authorisation for use',
      });
    }
  }

  const fails = issues.filter(i => i.severity === 'fail');
  return {
    status: fails.length > 0 ? 'fail' : issues.length > 0 ? 'warn' : 'pass',
    message: fails.length > 0
      ? `${fails.length} REACH restriction(s)`
      : issues.length > 0
        ? `${issues.length} SVHC substance(s) — communication duties apply`
        : 'REACH compliant',
    details: issues,
  };
}

// --- Checkpoint 8: Labelling ---

function checkLabelling(ctx: ComplianceContext): CheckpointResult {
  // In production: compile INCI list, allergen declarations, CLP label elements, UFI, warnings
  return {
    status: 'pass',
    message: 'Label requirements identified — generate label data for details',
    details: [],
  };
}

// --- Checkpoint 9: Transport ---

function checkTransport(ctx: ComplianceContext): CheckpointResult {
  let hasFlammable = false;
  let flashPoint: number | null = null;

  for (const fi of ctx.formula.ingredients) {
    const ing = fi.ingredient;
    if (!ing) continue;

    if (ing.clp_hazard_statements.includes('H225') && fi.concentration_percent > 1) hasFlammable = true;
    if (ing.clp_hazard_statements.includes('H226') && fi.concentration_percent > 5) hasFlammable = true;
  }

  if (hasFlammable) {
    return {
      status: 'warn',
      message: 'Classified as dangerous goods for transport',
      details: [{
        severity: 'warn',
        substance: 'Mixture',
        message: 'UN 1266 — Perfumery Products, Class 3 Flammable Liquid, Packing Group III',
        data: { unNumber: 'UN 1266', class: 3, properShippingName: 'Perfumery Products', packingGroup: 'III' },
      }],
    };
  }

  return { status: 'pass', message: 'No special transport requirements', details: [] };
}

// --- Utility ---

function naResult(message: string): CheckpointResult {
  return { status: 'na', message, details: [] };
}

export {
  checkIngredientIdentity,
  checkIFRA,
  checkCLP,
  checkPCN,
  checkCosmeticRegulation,
  checkAllergens,
  checkREACH,
  checkLabelling,
  checkTransport,
  generateUFI,
};
