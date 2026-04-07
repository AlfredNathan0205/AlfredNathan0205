// ============================================
// SCENTSHIELD — REST API
// ============================================

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { getSupabase, getSupabaseForUser } from '../agents/shared/src/db';
import { runCompliancePipeline } from '../core/src/compliance-engine';
import { MARKETS } from '../core/src/types';

const app = express();
app.use(cors());
app.use(express.json());

// --- Auth Middleware ---

async function authMiddleware(req: any, res: any, next: any) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Missing authorization token' });

  const db = getSupabase();
  const { data: { user }, error } = await db.auth.getUser(token);
  if (error || !user) return res.status(401).json({ error: 'Invalid token' });

  // Get tenant
  const { data: userData } = await db
    .from('users')
    .select('*, tenants(*)')
    .eq('id', user.id)
    .single();

  req.user = userData;
  req.tenant = userData?.tenants;
  req.supabase = getSupabaseForUser(token);
  next();
}

// --- Health ---

app.get('/api/v1/health', (req, res) => {
  res.json({ status: 'ok', service: 'scentshield-api', version: '1.0.0' });
});

// --- Formulas ---

app.post('/api/v1/formulas', authMiddleware, async (req: any, res) => {
  try {
    const { name, product_category, dosage_level, target_markets, ingredients } = req.body;

    const db = req.supabase;

    // Create formula
    const { data: formula, error } = await db
      .from('formulas')
      .insert({
        tenant_id: req.tenant.id,
        name,
        product_category,
        dosage_level,
        target_markets: target_markets || req.tenant.target_markets,
        created_by: req.user.id,
      })
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });

    // Add ingredients
    if (ingredients?.length) {
      const globalDb = getSupabase();
      for (const ing of ingredients) {
        // Resolve CAS to ingredient ID
        const { data: ingredient } = await globalDb
          .from('ingredients')
          .select('id')
          .eq('cas_number', ing.cas_number)
          .single();

        await db.from('formula_ingredients').insert({
          formula_id: formula.id,
          ingredient_id: ingredient?.id,
          cas_number: ing.cas_number,
          ingredient_name: ing.name || ing.cas_number,
          concentration_percent: ing.concentration_percent,
          function: ing.function,
        });
      }
    }

    res.status(201).json(formula);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/v1/formulas', authMiddleware, async (req: any, res) => {
  const { data, error } = await req.supabase
    .from('formulas')
    .select('*, formula_ingredients(*, ingredients(*))')
    .eq('tenant_id', req.tenant.id)
    .eq('is_archived', false)
    .order('updated_at', { ascending: false });

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

app.get('/api/v1/formulas/:id', authMiddleware, async (req: any, res) => {
  const { data, error } = await req.supabase
    .from('formulas')
    .select('*, formula_ingredients(*, ingredients(*)), compliance_results(*), documents(*)')
    .eq('id', req.params.id)
    .single();

  if (error) return res.status(404).json({ error: 'Formula not found' });
  res.json(data);
});

// --- Compliance Check ---

app.post('/api/v1/formulas/:id/check', authMiddleware, async (req: any, res) => {
  try {
    const db = req.supabase;
    const globalDb = getSupabase();

    // Get formula with ingredients
    const { data: formula, error } = await db
      .from('formulas')
      .select('*, formula_ingredients(*, ingredients(*, ncs_constituents(*)))')
      .eq('id', req.params.id)
      .single();

    if (error || !formula) return res.status(404).json({ error: 'Formula not found' });

    // Map to engine format
    const engineFormula = {
      ...formula,
      ingredients: formula.formula_ingredients.map((fi: any) => ({
        ...fi,
        ingredient: fi.ingredients,
        ncs_constituents: fi.ingredients?.ncs_constituents,
      })),
    };

    // Resolve markets
    const marketConfigs = formula.target_markets
      .map((code: string) => MARKETS.find(m => m.code === code))
      .filter(Boolean);

    // Run pipeline
    const result = await runCompliancePipeline(engineFormula, marketConfigs);

    // Store results
    await globalDb.from('compliance_results').delete().eq('formula_id', formula.id);

    for (const [marketCode, marketResult] of Object.entries(result.markets)) {
      for (const [checkpoint, cpResult] of Object.entries(marketResult.checkpoints)) {
        await globalDb.from('compliance_results').insert({
          formula_id: formula.id,
          market_code: marketCode,
          checkpoint,
          status: cpResult.status,
          message: cpResult.message,
          details: cpResult.details,
        });
      }
    }

    // Update formula status
    await db.from('formulas').update({
      compliance_status: result.overall,
      last_checked_at: result.checked_at,
    }).eq('id', formula.id);

    res.json(result);
  } catch (err) {
    console.error('Compliance check error:', err);
    res.status(500).json({ error: 'Compliance check failed' });
  }
});

// --- Ingredients Search ---

app.get('/api/v1/ingredients/search', async (req, res) => {
  const q = String(req.query.q || '');
  if (q.length < 2) return res.json([]);

  const db = getSupabase();

  // Search by CAS, INCI name, or common names
  const { data, error } = await db
    .from('ingredients')
    .select('id, cas_number, inci_name, common_names, is_ncs, ifra_status, is_eu_allergen, reach_status')
    .or(`cas_number.ilike.%${q}%,inci_name.ilike.%${q}%,common_names.cs.{${q}}`)
    .limit(20);

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

app.get('/api/v1/ingredients/:cas', async (req, res) => {
  const db = getSupabase();
  const { data, error } = await db
    .from('ingredients')
    .select('*, ncs_constituents(*)')
    .eq('cas_number', req.params.cas)
    .single();

  if (error) return res.status(404).json({ error: 'Ingredient not found' });
  res.json(data);
});

// --- Alerts ---

app.get('/api/v1/alerts', authMiddleware, async (req: any, res) => {
  const { data, error } = await req.supabase
    .from('alerts')
    .select('*')
    .or(`tenant_id.eq.${req.tenant.id},tenant_id.is.null`)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// --- Documents ---

app.post('/api/v1/formulas/:id/documents/:type', authMiddleware, async (req: any, res) => {
  const { type } = req.params;
  const { market, language } = req.body;

  // TODO: Implement document generation per type
  // For now, return a placeholder
  res.json({
    status: 'queued',
    message: `${type} generation for market ${market} (${language}) has been queued.`,
    document_id: `doc_${Date.now()}`,
  });
});

// --- Webhooks ---

app.post('/api/v1/webhooks', authMiddleware, async (req: any, res) => {
  const { url, secret, events } = req.body;

  const db = req.supabase;
  const { data, error } = await db.from('webhooks').insert({
    tenant_id: req.tenant.id,
    url,
    secret,
    events,
  }).select().single();

  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json(data);
});

// --- Regulatory Changes (Public) ---

app.get('/api/v1/regulatory/changes', async (req, res) => {
  const db = getSupabase();
  const { data, error } = await db
    .from('regulatory_changes')
    .select('id, source, regulation, change_type, title, summary, affected_substances, effective_date, transition_deadline, detected_at')
    .order('detected_at', { ascending: false })
    .limit(20);

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// --- Embed (Lightweight, API-key auth) ---

app.post('/api/v1/embed/check', async (req, res) => {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey) return res.status(401).json({ error: 'Missing API key' });

  // TODO: Validate API key, resolve tenant
  // For now, run check without tenant context
  res.json({ message: 'Embed check endpoint — implement with API key auth' });
});

// --- Start ---

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`\n  🧪 ScentShield API running on port ${PORT}\n`);
});

export default app;
