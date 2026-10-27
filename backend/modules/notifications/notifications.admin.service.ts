import {notificationImage} from './notifications.image.service';
import * as repository from './notifications.admin.repository';
import notifications = require('./notifications.service');
import hub = require('../../realtime/notificationHub');
import * as email from './notifications.email.service';
import * as emailRepository from './notifications.email.repository';
const fail = (message: string, status = 400): never => { throw Object.assign(new Error(message), { status }); };
const db = require('../../db');
const roles = ['student', 'alumni', 'employee', 'scanner', 'staff', 'admin', 'super_admin'];
const destinations = ['/my-library', '/bulletin', '/services/borrowing', '/catalogue'];
export function validate(input: any, now = new Date()) {
    if (input.sendEmail !== undefined && typeof input.sendEmail !== 'boolean') fail('Choose whether to send email.');
    if (typeof input.title !== 'string' || !input.title.trim() || input.title.length > 200)
        fail('Enter a title of up to 200 characters.');
    if (typeof input.body !== 'string' || !input.body.trim() || input.body.length > 2000)
        fail('Enter a message of up to 2,000 characters.');
    if (!['announcement', 'reminder', 'reservation_ready', 'reservation_cancelled', 'overdue_fine'].includes(input.type))
        fail('Choose a notification type.');
    if (!['all', 'role', 'user', 'users'].includes(input.audienceType))
        fail('Choose an audience.');
    if (input.audienceType === 'role' && !roles.includes(input.audienceRole))
        fail('Choose a valid audience role.');
    if (input.audienceType === 'user' && (!Number.isSafeInteger(Number(input.audienceUserId)) || Number(input.audienceUserId) < 1))
        fail('Select an active patron.');
    if (input.href && !destinations.includes(input.href) && !/^\/bulletin\?post=[1-9][0-9]*$/.test(input.href))
        fail('Choose a destination from the list.');
    const scheduled = input.scheduledAt ? new Date(input.scheduledAt) : null;
    if (scheduled && (!Number.isFinite(scheduled.getTime()) || scheduled <= now))
        fail('Choose a send time in the future.');
    const expires = input.expiresAt ? new Date(input.expiresAt) : null;
    if (expires && (!Number.isFinite(expires.getTime()) || expires <= (scheduled || now)))
        fail('Expiry must be after the send time.');
    return { ...notificationImage(input), type: input.type, title: input.title.trim(), body: input.body.trim(), href: input.href || null, audienceType: input.audienceType, audienceUserId: input.audienceType === 'user' ? Number(input.audienceUserId) : null, audienceUserIds: input.audienceType === 'users' ? selectedUserIds(input) : undefined, audienceRole: input.audienceType === 'role' ? input.audienceRole : null, expiresAt: expires, scheduledAt: scheduled,sendEmail:input.sendEmail === true };
}
export function selectedUserIds(input: any): number[] {
    const raw = input.audienceUserIds ?? input['audienceUserIds[]'];
    const values = Array.isArray(raw) ? raw : typeof raw === 'string' ? raw.split(',') : [];
    if (!values.length || values.some((id: unknown) => !['string','number'].includes(typeof id) || !Number.isSafeInteger(Number(id)) || Number(id) < 1))
        fail('Select active patrons with valid IDs.');
    return [...new Set<number>(values.map(Number))].sort((a, b) => a - b);
}
export async function count(input: any) {
    const type = String(input.audienceType || 'all');
    if (!['all', 'role', 'user', 'users'].includes(type) || type === 'role' && !roles.includes(input.audienceRole)) fail('Choose a valid audience.');
    if (type === 'user' && (!Number.isSafeInteger(Number(input.audienceUserId)) || Number(input.audienceUserId) < 1)) fail('Select an active patron.');
    return repository.audienceCount(type, input.audienceRole || null, Number(input.audienceUserId) || null, type === 'users' ? selectedUserIds(input) : []);
}
export async function emailPreview(input: any) {
    await count(input);
    return email.preview({...input, ...(input.audienceType === 'users' ? {audienceUserIds:selectedUserIds(input)} : {})});
}
export async function create(input: any, actor: number) {
    const postMatch = typeof input.href === 'string' && /^\/bulletin\?post=([1-9][0-9]*)$/.exec(input.href);
    const value = validate(postMatch ? {...input,imageUrl:null,imagePublicId:null,imageAlt:null} : input);
    if (postMatch) {
        const [[post]] = await db.query('SELECT image_url,image_public_id,image_alt FROM bulletin_posts WHERE id=? AND deleted_at IS NULL',[Number(postMatch[1])]);
        if (!post) fail('The selected bulletin post is no longer available.',409);
        value.imageUrl=post.image_url; value.imagePublicId=post.image_public_id; value.imageAlt=post.image_alt;
    }
    const recipients = await count(value);
    if (!recipients)
        fail('This audience has no active recipients.');
    if (value.audienceType !== 'user' && Number(input.confirmedRecipientCount) !== recipients)
        fail('The recipient count changed. Review the audience and confirm again.', 409);
    if (value.sendEmail) {
        const preview = await email.preview(value);
        if (!preview.enabled) fail(preview.reason || 'Email delivery is paused.',409);
        if (!preview.emailCount) fail('This audience has no verified email recipients. Uncheck email to send in-app only.',409);
        if (Number(input.confirmedEmailCount)!==preview.emailCount || Number(input.confirmedRecipientCount)!==preview.inAppCount) fail('The recipient counts changed. Review and confirm again.',409);
    }
    const { scheduledAt, ...payload } = value;
    if (scheduledAt) {
        const queueId = await repository.enqueue({ ...payload, manualNotification:true,createdBy: actor, scheduledAt: scheduledAt.toISOString() }, scheduledAt);
        return { queueId, status: 'scheduled', recipientCount: recipients };
    }
    if (value.sendEmail || value.audienceType === 'users') return email.publish({...payload,createdBy:actor},{total:Number(input.confirmedRecipientCount),email:Number(input.confirmedEmailCount)});
    return notifications.createNotification({ ...payload, createdBy: actor });
}
export async function list(input: any) {
    const tab = ['announcements', 'system', 'all'].includes(input.tab) ? input.tab : 'announcements', filter = ['manual', 'automatic', 'failed', 'all'].includes(input.filter) ? input.filter : 'all';
    const page = Math.max(1, Math.floor(Number(input.page) || 1)), limit = Math.min(100, Math.max(1, Math.floor(Number(input.limit) || 20)));
    const result = await repository.list({ tab, filter, search: String(input.q || '').trim().slice(0, 200), page, limit });
    return { notifications: result.rows, counts: result.counts, pagination: { page, limit, total: result.total, totalPages: Math.max(1, Math.ceil(result.total / limit)) } };
}
export async function action(key: string, action: string, actor: number, input: any) {
    const record = await repository.get(key);
    if (!record)
        fail('Notification not found.', 404);
    if (action === 'expire') {
        if (!await repository.expire(key))
            fail('This notification changed or is being delivered. Refresh and try again.', 409);
        try {
            if (record.audience_type === 'users')
                for (const id of record.audience_user_ids || []) hub.pushNotification(id, { type: 'notification.audience_changed' });
            else if (record.audience_type === 'user')
                hub.pushNotification(record.audience_user_id, { type: 'notification.audience_changed' });
            else
                hub.pushAudienceChanged({ audienceType: record.audience_type, audienceRole: record.audience_role });
        }
        catch { /* Saved expiry remains authoritative if a socket disconnects. */ }
        return { success: true };
    }
    if (action !== 'resend')
        fail('Unknown notification action.');
    const recipients = await count({ audienceType: record.audience_type, audienceRole: record.audience_role, audienceUserId: record.audience_user_id, audienceUserIds: record.audience_user_ids });
    if (!recipients)
        fail('This audience has no active recipients.');
    if (record.audience_type !== 'user' && Number(input.confirmedRecipientCount) !== recipients)
        fail('The recipient count changed. Confirm again.', 409);
    if (record.queue_id) {
        if (record.delivery_status !== 'failed')
            fail('Only failed queued notifications can be retried.');
        if (!await repository.retry(record.queue_id))
            fail('Delivery already started. Refresh and try again.', 409);
        return { success: true };
    }
    fail('Open the compose form to resend with fresh recipient confirmation.',409);
}
export async function details(key: string) { const record = await repository.get(key); if (!record)
    fail('Notification not found.', 404); const day = new Date(record.created_at).toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
    const rows=record.origin === 'automatic' ? await repository.group(record.type, day, record.delivery_status) : [record];
    return Promise.all(rows.map(async row=>({...row,email_requested:Boolean(Number(row.email_requested)),email_summary:row.email_batch_id ? await emailRepository.summary(row.id,row.email_batch_id) : null})));
}
