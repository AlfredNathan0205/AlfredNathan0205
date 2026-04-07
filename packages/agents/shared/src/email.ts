import { Resend } from 'resend';

let resend: Resend | null = null;

function getResend(): Resend {
  if (!resend) {
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
}

export async function sendEmail(params: {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
  replyTo?: string;
  tags?: { name: string; value: string }[];
}): Promise<{ id: string }> {
  const { data, error } = await getResend().emails.send({
    from: params.from ?? process.env.RESEND_FROM_EMAIL ?? 'ScentShield <notifications@scentshield.ai>',
    to: Array.isArray(params.to) ? params.to : [params.to],
    subject: params.subject,
    html: params.html,
    reply_to: params.replyTo,
    tags: params.tags,
  });

  if (error) throw new Error(`Email send failed: ${error.message}`);
  return { id: data?.id ?? 'unknown' };
}

export async function sendAlertEmail(
  to: string,
  alertTitle: string,
  alertBody: string,
  severity: 'info' | 'warning' | 'critical',
): Promise<void> {
  const severityColors = { info: '#60a5fa', warning: '#fbbf24', critical: '#f87171' };
  const color = severityColors[severity];

  await sendEmail({
    to,
    subject: `[ScentShield ${severity.toUpperCase()}] ${alertTitle}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #0f0f11; padding: 24px; border-radius: 12px;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 16px;">
            <div style="width: 32px; height: 32px; border-radius: 6px; background: linear-gradient(135deg, #c8956c, #8a6545); display: flex; align-items: center; justify-content: center; color: white; font-weight: bold;">S</div>
            <span style="font-size: 18px; font-weight: 700; color: #dbb08a; letter-spacing: 1px;">SCENTSHIELD</span>
          </div>
          <div style="border-left: 3px solid ${color}; padding: 12px 16px; background: rgba(255,255,255,0.03); border-radius: 0 8px 8px 0; margin-bottom: 16px;">
            <div style="font-weight: 600; color: ${color}; margin-bottom: 4px;">${severity.toUpperCase()}: ${alertTitle}</div>
            <div style="color: #e8e4df; line-height: 1.6;">${alertBody}</div>
          </div>
          <a href="${process.env.APP_URL}/alerts" style="display: inline-block; background: #c8956c; color: #0f0f11; padding: 10px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">View in ScentShield</a>
        </div>
      </div>
    `,
    tags: [{ name: 'category', value: `alert_${severity}` }],
  });
}
