// ============================================
// SCENTSHIELD — Seed Ingredients Database
// Run: npm run db:seed
// ============================================

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// --- Core fragrance ingredients with real regulatory data ---
// This is the MVP seed set. Production will have 3000+ ingredients.
// Sources: IFRA Standards Library, ECHA C&L Inventory, EU Cosmetic Reg Annexes

const INGREDIENTS = [
  {
    cas_number: '60-12-8', inci_name: 'Phenylethyl Alcohol', common_names: ['PEA', 'Rose Alcohol', '2-Phenylethanol'],
    is_ncs: false, ifra_status: 'restriction', ifra_limits: { '4': 5.0, '5A': 2.5, '9': 10.0, '10B': 8.0 },
    clp_hazard_statements: ['H302', 'H319'], clp_pictograms: ['GHS07'], clp_signal_word: 'Warning', clp_skin_sensitiser: false,
    is_eu_allergen: false, eu_annex_ii: false, eu_annex_iii: false, reach_status: 'registered',
  },
  {
    cas_number: '78-70-6', inci_name: 'Linalool', common_names: ['Linalool', '3,7-Dimethyl-1,6-octadien-3-ol'],
    is_ncs: false, ifra_status: 'restriction', ifra_limits: { '4': 25.0, '5A': 10.0, '5D': 1.5, '9': 25.0, '10B': 20.0 },
    clp_hazard_statements: ['H315', 'H317', 'H319'], clp_pictograms: ['GHS07'], clp_signal_word: 'Warning', clp_skin_sensitiser: true,
    is_eu_allergen: true, allergen_threshold_leave_on: 0.001, allergen_threshold_rinse_off: 0.01,
    eu_annex_ii: false, eu_annex_iii: false, reach_status: 'registered',
  },
  {
    cas_number: '5392-40-5', inci_name: 'Citral', common_names: ['Citral', 'Geranial', 'Neral', 'Lemonal'],
    is_ncs: false, ifra_status: 'restriction', ifra_limits: { '4': 0.6, '5A': 0.3, '5D': 0.02, '9': 3.0, '10B': 1.0 },
    clp_hazard_statements: ['H315', 'H317', 'H319'], clp_pictograms: ['GHS07'], clp_signal_word: 'Warning', clp_skin_sensitiser: true,
    is_eu_allergen: true, allergen_threshold_leave_on: 0.001, allergen_threshold_rinse_off: 0.01,
    eu_annex_ii: false, eu_annex_iii: false, reach_status: 'registered',
  },
  {
    cas_number: '106-22-9', inci_name: 'Citronellol', common_names: ['Citronellol', 'beta-Citronellol', 'Dihydrogeraniol'],
    is_ncs: false, ifra_status: 'restriction', ifra_limits: { '4': 4.6, '5A': 2.3, '9': 11.5, '10B': 7.5 },
    clp_hazard_statements: ['H315', 'H317'], clp_pictograms: ['GHS07'], clp_signal_word: 'Warning', clp_skin_sensitiser: true,
    is_eu_allergen: true, allergen_threshold_leave_on: 0.001, allergen_threshold_rinse_off: 0.01,
    eu_annex_ii: false, eu_annex_iii: false, reach_status: 'registered',
  },
  {
    cas_number: '101-86-0', inci_name: 'Hexyl Cinnamal', common_names: ['Hexyl Cinnamaldehyde', 'alpha-Hexylcinnamaldehyde'],
    is_ncs: false, ifra_status: 'restriction', ifra_limits: { '4': 3.28, '5A': 0.82, '5D': 0.02, '9': 8.2, '10B': 5.0 },
    clp_hazard_statements: ['H317', 'H411'], clp_pictograms: ['GHS07', 'GHS09'], clp_signal_word: 'Warning', clp_skin_sensitiser: true,
    is_eu_allergen: true, allergen_threshold_leave_on: 0.001, allergen_threshold_rinse_off: 0.01,
    eu_annex_ii: false, eu_annex_iii: false, reach_status: 'registered',
  },
  {
    cas_number: '106-24-1', inci_name: 'Geraniol', common_names: ['Geraniol', 'trans-Geraniol'],
    is_ncs: false, ifra_status: 'restriction', ifra_limits: { '4': 5.3, '5A': 2.65, '9': 13.25, '10B': 8.6 },
    clp_hazard_statements: ['H315', 'H317', 'H318'], clp_pictograms: ['GHS05', 'GHS07'], clp_signal_word: 'Danger', clp_skin_sensitiser: true,
    is_eu_allergen: true, allergen_threshold_leave_on: 0.001, allergen_threshold_rinse_off: 0.01,
    eu_annex_ii: false, eu_annex_iii: false, reach_status: 'registered',
  },
  {
    cas_number: '97-53-0', inci_name: 'Eugenol', common_names: ['Eugenol', 'Clove Phenol', '4-Allyl-2-methoxyphenol'],
    is_ncs: false, ifra_status: 'restriction', ifra_limits: { '4': 0.5, '5A': 0.2, '9': 2.0, '10B': 1.3 },
    clp_hazard_statements: ['H302', 'H317', 'H319'], clp_pictograms: ['GHS07'], clp_signal_word: 'Warning', clp_skin_sensitiser: true,
    is_eu_allergen: true, allergen_threshold_leave_on: 0.001, allergen_threshold_rinse_off: 0.01,
    eu_annex_ii: false, eu_annex_iii: false, reach_status: 'registered',
  },
  {
    cas_number: '91-64-5', inci_name: 'Coumarin', common_names: ['Coumarin', '2H-Chromen-2-one'],
    is_ncs: false, ifra_status: 'restriction', ifra_limits: { '4': 2.44, '5A': 1.22, '9': 6.1, '10B': 3.91 },
    clp_hazard_statements: ['H302', 'H317'], clp_pictograms: ['GHS07'], clp_signal_word: 'Warning', clp_skin_sensitiser: true,
    is_eu_allergen: true, allergen_threshold_leave_on: 0.001, allergen_threshold_rinse_off: 0.01,
    eu_annex_ii: false, eu_annex_iii: false, reach_status: 'registered',
  },
  {
    cas_number: '80-54-6', inci_name: 'Lilial', common_names: ['Lilial', 'Butylphenyl Methylpropional', 'BMHCA', 'Lysmeral'],
    is_ncs: false, ifra_status: 'prohibition', ifra_limits: {},
    clp_hazard_statements: ['H302', 'H315', 'H317', 'H361'], clp_pictograms: ['GHS07', 'GHS08'], clp_signal_word: 'Warning', clp_skin_sensitiser: true,
    is_eu_allergen: true, allergen_threshold_leave_on: 0.001, allergen_threshold_rinse_off: 0.01,
    eu_annex_ii: true, eu_annex_ii_note: 'Banned in EU cosmetics since March 2022 — CMR Category 1B (Reproductive toxicity)',
    eu_annex_iii: false, is_cmr: true, cmr_category: '1B', reach_status: 'restricted',
  },
  {
    cas_number: '5989-27-5', inci_name: 'Limonene', common_names: ['d-Limonene', 'Limonene', '(+)-Limonene'],
    is_ncs: false, ifra_status: 'restriction', ifra_limits: { '4': 19.5, '5A': 9.75, '9': 25.0, '10B': 20.0 },
    clp_hazard_statements: ['H226', 'H304', 'H315', 'H317', 'H400', 'H410'], clp_pictograms: ['GHS02', 'GHS07', 'GHS08', 'GHS09'], clp_signal_word: 'Danger', clp_skin_sensitiser: true,
    is_eu_allergen: true, allergen_threshold_leave_on: 0.001, allergen_threshold_rinse_off: 0.01,
    eu_annex_ii: false, eu_annex_iii: false, reach_status: 'registered',
  },
  {
    cas_number: '1222-05-5', inci_name: 'Galaxolide', common_names: ['Galaxolide', 'HHCB', 'Abbalide', '1,3,4,6,7,8-Hexahydro-4,6,6,7,8,8-hexamethylcyclopenta[g]-2-benzopyran'],
    is_ncs: false, ifra_status: 'restriction', ifra_limits: { '4': 14.0, '5A': 7.0, '9': 25.0 },
    clp_hazard_statements: ['H410'], clp_pictograms: ['GHS09'], clp_signal_word: 'Warning', clp_skin_sensitiser: false,
    is_eu_allergen: false, eu_annex_ii: false, eu_annex_iii: false, reach_status: 'svhc_candidate',
  },
  {
    cas_number: '54464-57-2', inci_name: 'Tetramethyl Acetyloctahydronaphthalenes', common_names: ['Iso E Super', 'Molecule 01', 'OTNE'],
    is_ncs: false, ifra_status: 'restriction', ifra_limits: { '4': 24.5, '5A': 12.25, '9': 25.0 },
    clp_hazard_statements: ['H411'], clp_pictograms: ['GHS09'], clp_signal_word: null, clp_skin_sensitiser: false,
    is_eu_allergen: false, eu_annex_ii: false, eu_annex_iii: false, reach_status: 'registered',
  },
  {
    cas_number: '14371-10-9', inci_name: 'Cinnamaldehyde', common_names: ['Cinnamal', 'Cinnamic Aldehyde', 'trans-Cinnamaldehyde'],
    is_ncs: false, ifra_status: 'restriction', ifra_limits: { '4': 0.05, '5A': 0.01, '9': 0.5, '10B': 0.3 },
    clp_hazard_statements: ['H312', 'H315', 'H317', 'H319'], clp_pictograms: ['GHS07'], clp_signal_word: 'Warning', clp_skin_sensitiser: true,
    is_eu_allergen: true, allergen_threshold_leave_on: 0.001, allergen_threshold_rinse_off: 0.01,
    eu_annex_ii: false, eu_annex_iii: false, reach_status: 'registered',
  },
  {
    cas_number: '64-17-5', inci_name: 'Alcohol', common_names: ['Ethanol', 'Ethyl Alcohol', 'Alcohol Denat.'],
    is_ncs: false, ifra_status: 'no_restriction', ifra_limits: {},
    clp_hazard_statements: ['H225', 'H319'], clp_pictograms: ['GHS02', 'GHS07'], clp_signal_word: 'Danger', clp_skin_sensitiser: false,
    is_eu_allergen: false, eu_annex_ii: false, eu_annex_iii: false, reach_status: 'registered',
    flash_point: 13,
  },
  {
    cas_number: '7732-18-5', inci_name: 'Aqua', common_names: ['Water', 'Purified Water', 'Eau'],
    is_ncs: false, ifra_status: 'no_restriction', ifra_limits: {},
    clp_hazard_statements: [], clp_pictograms: [], clp_signal_word: null, clp_skin_sensitiser: false,
    is_eu_allergen: false, eu_annex_ii: false, eu_annex_iii: false, reach_status: 'exempt',
  },
  {
    cas_number: '127-51-5', inci_name: 'Isomethyl Ionone', common_names: ['alpha-Isomethyl Ionone', 'Methyl Ionone gamma'],
    is_ncs: false, ifra_status: 'restriction', ifra_limits: { '4': 5.21, '5A': 1.63, '9': 6.51, '10B': 4.17 },
    clp_hazard_statements: ['H315', 'H317', 'H411'], clp_pictograms: ['GHS07', 'GHS09'], clp_signal_word: 'Warning', clp_skin_sensitiser: true,
    is_eu_allergen: true, allergen_threshold_leave_on: 0.001, allergen_threshold_rinse_off: 0.01,
    eu_annex_ii: false, eu_annex_iii: false, reach_status: 'registered',
  },
  {
    cas_number: '122-40-7', inci_name: 'Amyl Cinnamal', common_names: ['Amyl Cinnamic Aldehyde', 'ACA', 'alpha-Amylcinnamaldehyde'],
    is_ncs: false, ifra_status: 'restriction', ifra_limits: { '4': 1.55, '5A': 0.39, '9': 3.88, '10B': 2.49 },
    clp_hazard_statements: ['H317', 'H411'], clp_pictograms: ['GHS07', 'GHS09'], clp_signal_word: 'Warning', clp_skin_sensitiser: true,
    is_eu_allergen: true, allergen_threshold_leave_on: 0.001, allergen_threshold_rinse_off: 0.01,
    eu_annex_ii: false, eu_annex_iii: false, reach_status: 'registered',
  },
  {
    cas_number: '118-58-1', inci_name: 'Benzyl Salicylate', common_names: ['Benzyl Salicylate'],
    is_ncs: false, ifra_status: 'restriction', ifra_limits: { '4': 2.44, '5A': 1.22, '9': 6.1, '10B': 3.91 },
    clp_hazard_statements: ['H317', 'H411'], clp_pictograms: ['GHS07', 'GHS09'], clp_signal_word: 'Warning', clp_skin_sensitiser: true,
    is_eu_allergen: true, allergen_threshold_leave_on: 0.001, allergen_threshold_rinse_off: 0.01,
    eu_annex_ii: false, eu_annex_iii: false, reach_status: 'registered',
  },
  {
    cas_number: '100-51-6', inci_name: 'Benzyl Alcohol', common_names: ['Benzyl Alcohol', 'Benzenemethanol'],
    is_ncs: false, ifra_status: 'restriction', ifra_limits: { '4': 10.0, '5A': 5.0, '9': 25.0, '10B': 10.0 },
    clp_hazard_statements: ['H302', 'H332'], clp_pictograms: ['GHS07'], clp_signal_word: 'Warning', clp_skin_sensitiser: false,
    is_eu_allergen: true, allergen_threshold_leave_on: 0.001, allergen_threshold_rinse_off: 0.01,
    eu_annex_ii: false, eu_annex_iii: false, eu_annex_v: true, reach_status: 'registered',
  },
  {
    cas_number: '120-51-4', inci_name: 'Benzyl Benzoate', common_names: ['Benzyl Benzoate'],
    is_ncs: false, ifra_status: 'restriction', ifra_limits: { '4': 12.0, '5A': 6.0, '9': 25.0, '10B': 10.0 },
    clp_hazard_statements: ['H302', 'H411'], clp_pictograms: ['GHS07', 'GHS09'], clp_signal_word: 'Warning', clp_skin_sensitiser: false,
    is_eu_allergen: true, allergen_threshold_leave_on: 0.001, allergen_threshold_rinse_off: 0.01,
    eu_annex_ii: false, eu_annex_iii: false, reach_status: 'registered',
  },
];

// --- NCS (Natural Complex Substances) with constituent breakdowns ---

const NCS_INGREDIENTS = [
  {
    cas_number: '8000-28-0', inci_name: 'Lavandula Angustifolia Oil', common_names: ['Lavender Oil', 'English Lavender Oil', 'True Lavender Oil'],
    is_ncs: true, ncs_source: 'Lavandula angustifolia',
    ifra_status: 'restriction', ifra_limits: { '4': 20.0, '5A': 10.0, '9': 25.0 },
    clp_hazard_statements: ['H226', 'H304', 'H315', 'H317'], clp_pictograms: ['GHS02', 'GHS07', 'GHS08'], clp_signal_word: 'Danger', clp_skin_sensitiser: true,
    is_eu_allergen: false, eu_annex_ii: false, eu_annex_iii: false, reach_status: 'registered',
    constituents: [
      { cas: '78-70-6', name: 'Linalool', pctMin: 25, pctMax: 45, isAllergen: true },
      { cas: '115-95-7', name: 'Linalyl Acetate', pctMin: 25, pctMax: 47, isAllergen: false },
      { cas: '5989-27-5', name: 'Limonene', pctMin: 0.2, pctMax: 2, isAllergen: true },
      { cas: '106-24-1', name: 'Geraniol', pctMin: 0.5, pctMax: 3, isAllergen: true },
      { cas: '5392-40-5', name: 'Citral', pctMin: 0.1, pctMax: 0.5, isAllergen: true },
    ],
  },
  {
    cas_number: '8007-08-7', inci_name: 'Zingiber Officinale Root Oil', common_names: ['Ginger Oil', 'Ginger Root Oil'],
    is_ncs: true, ncs_source: 'Zingiber officinale',
    ifra_status: 'restriction', ifra_limits: { '4': 3.0, '5A': 1.5, '9': 7.5 },
    clp_hazard_statements: ['H226', 'H304', 'H315', 'H317'], clp_pictograms: ['GHS02', 'GHS07', 'GHS08'], clp_signal_word: 'Danger', clp_skin_sensitiser: true,
    is_eu_allergen: false, eu_annex_ii: false, eu_annex_iii: false, reach_status: 'registered',
    constituents: [
      { cas: '87-44-5', name: 'beta-Caryophyllene', pctMin: 1, pctMax: 15, isAllergen: false },
      { cas: '23986-74-5', name: 'Zingiberene', pctMin: 20, pctMax: 35, isAllergen: false },
      { cas: '5392-40-5', name: 'Citral', pctMin: 2, pctMax: 8, isAllergen: true },
      { cas: '106-24-1', name: 'Geraniol', pctMin: 0.5, pctMax: 3, isAllergen: true },
    ],
  },
  {
    cas_number: '8008-57-9', inci_name: 'Citrus Aurantium Dulcis Peel Oil', common_names: ['Orange Oil', 'Sweet Orange Oil'],
    is_ncs: true, ncs_source: 'Citrus sinensis',
    ifra_status: 'restriction', ifra_limits: { '4': 12.0, '5A': 6.0, '9': 25.0 },
    clp_hazard_statements: ['H226', 'H304', 'H315', 'H317', 'H400', 'H410'], clp_pictograms: ['GHS02', 'GHS07', 'GHS08', 'GHS09'], clp_signal_word: 'Danger', clp_skin_sensitiser: true,
    is_eu_allergen: false, eu_annex_ii: false, eu_annex_iii: false, reach_status: 'registered',
    constituents: [
      { cas: '5989-27-5', name: 'Limonene', pctMin: 90, pctMax: 97, isAllergen: true },
      { cas: '78-70-6', name: 'Linalool', pctMin: 0.1, pctMax: 2, isAllergen: true },
      { cas: '5392-40-5', name: 'Citral', pctMin: 0.1, pctMax: 1, isAllergen: true },
    ],
  },
];

// --- Seed Function ---

async function seed() {
  console.log('🧪 ScentShield — Seeding ingredient database...\n');

  // Seed simple ingredients
  let count = 0;
  for (const ing of INGREDIENTS) {
    const { error } = await supabase.from('ingredients').upsert({
      ...ing,
      data_sources: ['ifra_standards', 'echa_clp', 'eu_cosmetic_reg'],
      last_verified_at: new Date().toISOString(),
    }, { onConflict: 'cas_number' });

    if (error) {
      console.error(`  ✗ ${ing.cas_number} ${ing.inci_name}: ${error.message}`);
    } else {
      count++;
      console.log(`  ✓ ${ing.cas_number} ${ing.inci_name}`);
    }
  }

  // Seed NCS ingredients with constituents
  for (const ncs of NCS_INGREDIENTS) {
    const { constituents, ...ingData } = ncs;

    const { data, error } = await supabase.from('ingredients').upsert({
      ...ingData,
      data_sources: ['ifra_standards', 'echa_clp', 'eu_cosmetic_reg'],
      last_verified_at: new Date().toISOString(),
    }, { onConflict: 'cas_number' }).select('id').single();

    if (error) {
      console.error(`  ✗ ${ncs.cas_number} ${ncs.inci_name}: ${error.message}`);
      continue;
    }

    count++;
    console.log(`  ✓ ${ncs.cas_number} ${ncs.inci_name} (NCS)`);

    // Seed constituents
    for (const nc of constituents) {
      const { error: ncError } = await supabase.from('ncs_constituents').upsert({
        parent_ingredient_id: data.id,
        constituent_cas: nc.cas,
        constituent_name: nc.name,
        typical_pct_min: nc.pctMin,
        typical_pct_max: nc.pctMax,
        is_allergen: nc.isAllergen,
      }, { onConflict: 'parent_ingredient_id,constituent_cas' as any });

      if (ncError) {
        console.error(`    ✗ Constituent ${nc.cas}: ${ncError.message}`);
      } else {
        console.log(`    ↳ ${nc.cas} ${nc.name} (${nc.pctMin}-${nc.pctMax}%) ${nc.isAllergen ? '⚠ allergen' : ''}`);
      }
    }
  }

  console.log(`\n✅ Seeded ${count} ingredients (${NCS_INGREDIENTS.length} with NCS constituents)\n`);
  console.log('Next steps:');
  console.log('  npm run db:seed:ifra    — Seed full IFRA standards (3000+ substances)');
  console.log('  npm run db:seed:clp     — Seed ECHA C&L Inventory data');
  console.log('  npm run db:seed:allergens — Seed expanded 80+ allergen list');
}

seed().catch(console.error);
