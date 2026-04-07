import { getSupabase } from './db';
import type { AgentEventType, AgentEvent } from '@scentshield/core';

export async function emitEvent(
  eventType: AgentEventType,
  payload: Record<string, unknown>,
  sourceAgent: string,
  targetAgents?: string[],
): Promise<string> {
  const db = getSupabase();
  const { data, error } = await db
    .from('agent_events')
    .insert({
      event_type: eventType,
      payload,
      source_agent: sourceAgent,
      target_agents: targetAgents,
    })
    .select('id')
    .single();

  if (error) throw new Error(`Failed to emit event: ${error.message}`);
  return data.id;
}

export async function getPendingEvents(
  agentName: string,
  eventTypes?: AgentEventType[],
  limit = 50,
): Promise<AgentEvent[]> {
  const db = getSupabase();
  let query = db
    .from('agent_events')
    .select('*')
    .eq('status', 'pending')
    .not('processed_by', 'cs', `{${agentName}}`)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (eventTypes?.length) {
    query = query.in('event_type', eventTypes);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Failed to get events: ${error.message}`);
  return data ?? [];
}

export async function markEventProcessed(eventId: string, agentName: string): Promise<void> {
  const db = getSupabase();
  await db.rpc('array_append_unique', {
    table_name: 'agent_events',
    row_id: eventId,
    column_name: 'processed_by',
    value: agentName,
  });
  // Fallback: direct update
  const { data } = await db.from('agent_events').select('processed_by').eq('id', eventId).single();
  const processed = [...(data?.processed_by ?? []), agentName];
  await db.from('agent_events').update({ processed_by: processed, status: 'completed', processed_at: new Date().toISOString() }).eq('id', eventId);
}

export async function logAgentRun(
  agentName: string,
  triggerType: 'scheduled' | 'event' | 'manual',
  triggerEventId?: string,
): Promise<{ id: string; complete: (result: { actions: string[]; tokensUsed: number; error?: string }) => Promise<void> }> {
  const db = getSupabase();
  const startedAt = Date.now();
  const { data, error } = await db
    .from('agent_runs')
    .insert({ agent_name: agentName, trigger_type: triggerType, trigger_event_id: triggerEventId })
    .select('id')
    .single();

  if (error) throw new Error(`Failed to log agent run: ${error.message}`);

  return {
    id: data.id,
    complete: async (result) => {
      await db.from('agent_runs').update({
        status: result.error ? 'failed' : 'completed',
        completed_at: new Date().toISOString(),
        duration_ms: Date.now() - startedAt,
        actions_taken: result.actions,
        tokens_used: result.tokensUsed,
        error: result.error,
      }).eq('id', data.id);
    },
  };
}
