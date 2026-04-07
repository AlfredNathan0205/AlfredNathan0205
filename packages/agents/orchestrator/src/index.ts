// ============================================
// SCENTSHIELD — Agent Orchestrator
// Central coordinator for all autonomous agents
// ============================================

import 'dotenv/config';
import { getSupabase } from '../shared/src/db';
import { getPendingEvents, markEventProcessed, logAgentRun } from '../shared/src/events';
import type { AgentEventType } from '@scentshield/core';

// --- Agent Registry ---

interface AgentHandler {
  name: string;
  handles: AgentEventType[];
  process: (event: any) => Promise<{ actions: string[]; tokensUsed: number }>;
}

const agents: AgentHandler[] = [];

export function registerAgent(handler: AgentHandler) {
  agents.push(handler);
  console.log(`[Orchestrator] Registered agent: ${handler.name} (handles: ${handler.handles.join(', ')})`);
}

// --- Event Processing Loop ---

async function processEvents() {
  const db = getSupabase();

  for (const agent of agents) {
    try {
      const events = await getPendingEvents(agent.name, agent.handles, 10);

      for (const event of events) {
        const run = await logAgentRun(agent.name, 'event', event.id);
        try {
          console.log(`[${agent.name}] Processing event: ${event.event_type} (${event.id})`);
          const result = await agent.process(event);
          await markEventProcessed(event.id, agent.name);
          await run.complete({ actions: result.actions, tokensUsed: result.tokensUsed });
          console.log(`[${agent.name}] Completed: ${result.actions.length} actions`);
        } catch (err) {
          const error = err instanceof Error ? err.message : String(err);
          console.error(`[${agent.name}] Error: ${error}`);
          await run.complete({ actions: [], tokensUsed: 0, error });
        }
      }
    } catch (err) {
      console.error(`[Orchestrator] Error processing ${agent.name}:`, err);
    }
  }
}

// --- Scheduled Tasks ---

interface ScheduledTask {
  name: string;
  cron: string; // Not used directly — QStash or pg_cron handles scheduling
  handler: () => Promise<void>;
  lastRun?: Date;
  intervalMs: number; // Fallback polling interval
}

const scheduledTasks: ScheduledTask[] = [];

export function registerScheduledTask(task: Omit<ScheduledTask, 'lastRun'>) {
  scheduledTasks.push({ ...task, lastRun: undefined });
  console.log(`[Orchestrator] Registered scheduled task: ${task.name} (every ${task.intervalMs / 1000}s)`);
}

async function runScheduledTasks() {
  const now = Date.now();
  for (const task of scheduledTasks) {
    if (!task.lastRun || now - task.lastRun.getTime() >= task.intervalMs) {
      try {
        console.log(`[Scheduler] Running: ${task.name}`);
        await task.handler();
        task.lastRun = new Date();
      } catch (err) {
        console.error(`[Scheduler] Error in ${task.name}:`, err);
      }
    }
  }
}

// --- Main Loop ---

const POLL_INTERVAL_MS = 5000; // Check for events every 5 seconds

async function main() {
  console.log('\n');
  console.log('  ╔══════════════════════════════════════╗');
  console.log('  ║   SCENTSHIELD AI — Agent Orchestrator ║');
  console.log('  ║   All agents operational              ║');
  console.log('  ╚══════════════════════════════════════╝');
  console.log('\n');

  // Import and register agents
  // In production, each agent registers itself
  // For now, they're imported dynamically:

  // TODO: Import agents as they're built
  // await import('../monitoring/src/index');
  // await import('../content/src/index');
  // await import('../sales/src/index');
  // await import('../onboarding/src/index');
  // await import('../support/src/index');
  // await import('../billing/src/index');
  // await import('../complaints/src/index');

  console.log(`[Orchestrator] ${agents.length} agents registered`);
  console.log(`[Orchestrator] ${scheduledTasks.length} scheduled tasks registered`);
  console.log(`[Orchestrator] Starting event loop (poll interval: ${POLL_INTERVAL_MS}ms)\n`);

  // Event processing loop
  const loop = async () => {
    await processEvents();
    await runScheduledTasks();
    setTimeout(loop, POLL_INTERVAL_MS);
  };

  await loop();
}

// --- Real-time listener (alternative to polling) ---

async function startRealtimeListener() {
  const db = getSupabase();
  const channel = db.channel('agent-events')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'agent_events',
    }, (payload) => {
      console.log(`[Realtime] New event: ${payload.new.event_type}`);
      // Trigger immediate processing
      processEvents().catch(console.error);
    })
    .subscribe();

  console.log('[Orchestrator] Realtime listener active');
}

// Start
main().catch(console.error);
