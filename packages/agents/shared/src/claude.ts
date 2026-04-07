import Anthropic from '@anthropic-ai/sdk';

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

export interface AskClaudeOptions {
  system?: string;
  model?: 'claude-sonnet-4-20250514' | 'claude-opus-4-20250514';
  maxTokens?: number;
  temperature?: number;
}

export async function askClaude(
  prompt: string,
  options: AskClaudeOptions = {},
): Promise<string> {
  const {
    system,
    model = 'claude-sonnet-4-20250514',
    maxTokens = 2048,
    temperature = 0.3,
  } = options;

  const response = await getClient().messages.create({
    model,
    max_tokens: maxTokens,
    temperature,
    ...(system ? { system } : {}),
    messages: [{ role: 'user', content: prompt }],
  });

  const textBlock = response.content.find(b => b.type === 'text');
  return textBlock?.text ?? '';
}

export async function askClaudeJSON<T>(
  prompt: string,
  options: AskClaudeOptions = {},
): Promise<T> {
  const text = await askClaude(prompt, {
    ...options,
    system: `${options.system ?? ''}\n\nRespond ONLY with valid JSON. No markdown, no backticks, no preamble.`.trim(),
  });

  try {
    return JSON.parse(text.replace(/```json\n?|```/g, '').trim());
  } catch {
    throw new Error(`Failed to parse Claude response as JSON: ${text.slice(0, 200)}`);
  }
}

export async function interpretRegulation(
  regulationText: string,
  question: string,
): Promise<{ interpretation: string; confidence: number; sources: string[] }> {
  return askClaudeJSON(
    `You are a regulatory affairs specialist for the fragrance and cosmetics industry.

Given this regulation text:
<regulation>
${regulationText}
</regulation>

Answer this question: ${question}

Respond with JSON: { "interpretation": "...", "confidence": 0.0-1.0, "sources": ["..."] }
If confidence < 0.8, note that a qualified assessor should verify.`,
    { model: 'claude-opus-4-20250514', temperature: 0.1 },
  );
}
