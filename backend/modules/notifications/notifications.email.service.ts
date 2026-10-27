import { config, validateConfig } from '../email/email.config';
import * as repository from './notifications.email.repository';
import hub = require('../../realtime/notificationHub');
import type { CreateNotificationInput } from './notifications.types';

export async function preview(input: CreateNotificationInput) {
  const c = config(), counts = await repository.preview(input,c.periodStart);
  const enabled = c.enabled && c.routineEnabled;
  let reason: string | null = enabled ? null : 'Email delivery is paused. Enable account and routine email sending in the backend environment.';
  if (enabled) { try { validateConfig(); } catch { reason = 'Email configuration needs attention. Contact the deployment administrator.'; } }
  return { inAppCount:counts.total,emailCount:counts.eligible,skippedCount:counts.total-counts.eligible,
    enabled:enabled && !reason,reason,exclusions:counts.exclusions,dailyLimit:c.limit,securityReserve:c.reserve,usedToday:counts.used,queuedRoutine:counts.queued,
    remainingRoutine:Math.max(0,c.limit-c.reserve-counts.used-counts.queued),resetAt:`${c.periodEnd}T00:00:00Z` };
}
export async function publish(input: repository.ManualPublication, confirmed?: { total:number; email:number }) {
  const result = await repository.publish(input,confirmed);
  if (result.created) {
    try {
      if (result.record.audience_type === 'users') for (const id of result.record.audience_user_ids || []) hub.pushNotification(id,{type:'notification.audience_changed'});
      else if (result.record.audience_type === 'user') hub.pushNotification(result.record.audience_user_id,{type:'notification.audience_changed'});
      else hub.pushAudienceChanged({audienceType:result.record.audience_type,audienceRole:result.record.audience_role});
    } catch { console.error('[notifications] Manual notification saved; realtime refresh failed.'); }
  }
  return result.record;
}
