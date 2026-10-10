import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { TabsContent } from '@/components/ui/tabs';
import { AdminPageHeader, AdminPageTabs, AdminFilterChips, AdminDetailDrawer, AdminRowMenu, AdminIcon, AdminStatusBadge, useAdminConfirmDialog, useUnsavedChanges } from '@/features/admin';
import { AdminDateTime, formatAdminDate } from '@/features/admin';
import { useDebounce } from '@/hooks/use-debounce';
import { getApiErrorMessage } from '@/utils/apiError';
import { notificationKeys } from '../notifications.keys';
import { fetchAdminNotifications, searchNotificationRecipients, countNotificationRecipients, createAdminNotification, notificationAction, notificationDetails, type AdminNotification, type NotificationRecipient, type AudienceType } from './api';
import './notifications.css';
const types = [['announcement', 'Announcement'], ['reminder', 'Reminder'], ['reservation_ready', 'Reservation ready'], ['reservation_cancelled', 'Reservation cancelled'], ['overdue_fine', 'Overdue fine']];
const roles = ['student', 'alumni', 'employee', 'scanner', 'staff', 'admin', 'super_admin'];
const destinations = [['none', 'No destination'], ['/my-library', 'My Library'], ['/bulletin', 'Bulletin'], ['/services/borrowing', 'Borrowing services'], ['/catalogue', 'Catalogue']];
const defaultForm = { type: 'announcement', title: '', body: '', href: 'none', audienceType: 'all' as AudienceType, audienceRole: 'student', expiresAt: '', scheduledAt: '', sendMode: 'now' };
const label = (value: string) => types.find(item => item[0] === value)?.[1] || value.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase());
const time = (value: string | null) => value ? formatAdminDate(value) : '—';
function Field({ label: caption, id, children }: {
    label: string;
    id: string;
    children: React.ReactNode;
}) { return <div className="notification-field"><label htmlFor={id}>{caption}</label>{children}</div>; }
function Segments({ label: caption, value, items, onChange }: {
    label: string;
    value: string;
    items: [
        string,
        string
    ][];
    onChange: (value: string) => void;
}) { return <div className="notification-segments" role="group" aria-label={caption}>{items.map(([key, text]) => <button type="button" key={key} aria-pressed={value === key} onClick={() => onChange(key)}>{text}</button>)}</div>; }
function Audience({ item }: {
    item: AdminNotification;
}) { const patron = item.audience_user_patron_id; return item.audience_type === 'user' ? <Link className="notification-patron" to={`/admin/manage?q=${encodeURIComponent(patron || String(item.audience_user_id))}&status=all${patron ? `&patron=${encodeURIComponent(patron)}` : ''}`}>{item.audience_user_name || 'Patron'}</Link> : <span>{item.audience_type === 'all' ? 'All active users' : label(item.audience_role || 'role')}</span>; }
function Status({ item, group = false }: {
    item: AdminNotification;
    group?: boolean;
}) { return <div className="notification-delivery"><AdminStatusBadge status={item.delivery_status === 'failed' ? 'blocked' : item.delivery_status === 'available' ? 'ready' : item.delivery_status === 'expired' ? 'expired' : 'pending'}>{label(item.delivery_status)}</AdminStatusBadge><span>{item.delivery_status === 'available' || item.delivery_status === 'expired' ? `${Number(group ? item.group_reads : item.read_count) || 0} read` : 'Not sent yet'}</span></div>; }
export default function AdminNotifications() {
    const client = useQueryClient(), [params, setParams] = useSearchParams();
    const tab = params.get('tab') === 'system' ? 'system' : 'announcements';
    const [filter, setFilter] = useState('all'), [search, setSearch] = useState(''), [page, setPage] = useState(1), [compose, setCompose] = useState(false), [form, setForm] = useState(defaultForm), [recipient, setRecipient] = useState<NotificationRecipient | null>(null), [recipientSearch, setRecipientSearch] = useState(''), [detail, setDetail] = useState<AdminNotification | null>(null), [busy, setBusy] = useState(false), [exporting, setExporting] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');
    const { confirm, confirmDialog } = useAdminConfirmDialog();
    const guard = useUnsavedChanges({ form, recipient }, compose);
    const q = useDebounce(search, 250), recipientQ = useDebounce(recipientSearch.trim(), 300);
    const query = useQuery({ queryKey: [...notificationKeys.adminLists(), { tab, filter, q, page }], queryFn: ({ signal }) => fetchAdminNotifications({ tab, filter, q, page }, signal), placeholderData: keepPreviousData });
    const audience = { audienceType: form.audienceType, audienceRole: form.audienceType === 'role' ? form.audienceRole : null, audienceUserId: form.audienceType === 'user' ? recipient?.id || null : null };
    const countQuery = useQuery({ queryKey: [...notificationKeys.admin(), 'count', audience], queryFn: ({ signal }) => countNotificationRecipients(audience, signal), enabled: compose && (form.audienceType !== 'user' || Boolean(recipient)), staleTime: 0 });
    const recipientQuery = useQuery({ queryKey: notificationKeys.recipientSearch(recipientQ), queryFn: ({ signal }) => searchNotificationRecipients(recipientQ, signal), enabled: compose && form.audienceType === 'user' && !recipient && recipientQ.length >= 2 });
    const detailQuery = useQuery({ queryKey: [...notificationKeys.admin(), 'detail', detail?.record_key], queryFn: ({ signal }) => notificationDetails(detail!.record_key, signal), enabled: Boolean(detail) });
    const rows = query.data?.notifications || [], pagination = query.data?.pagination, counts = query.data?.counts;
    const set = (key: keyof typeof defaultForm, value: string) => { setForm(old => ({ ...old, [key]: value })); setError(''); };
    const open = (item?: AdminNotification) => { setForm(item ? { ...defaultForm, type: item.type, title: item.title, body: item.body, href: item.href || 'none', audienceType: item.audience_type, audienceRole: item.audience_role || 'student' } : { ...defaultForm }); setRecipient(item?.audience_type === 'user' ? { id: item.audience_user_id!, name: item.audience_user_name || 'Patron', role: '', student_employee_id: item.audience_user_patron_id || '', library_card_number: null, student_number: null, employee_number: null, username: item.audience_user_identifier } : null); setRecipientSearch(''); setDetail(null); setError(''); setCompose(true); };
    const close = async () => { if (!busy && await guard.confirmDiscard())
        setCompose(false); };
    const refresh = async () => { await client.invalidateQueries({ queryKey: notificationKeys.all }); };
    const send = async (event: React.FormEvent) => {
        event.preventDefault();
        if (busy)
            return;
        setBusy(true);
        setError('');
        try {
            if (!form.title.trim() || !form.body.trim())
                throw new Error('Enter a title and message.');
            if (form.sendMode === 'schedule' && (!form.scheduledAt || new Date(form.scheduledAt) <= new Date()))
                throw new Error('Choose a send time in the future.');
            const scheduledAt = form.sendMode === 'schedule' ? new Date(form.scheduledAt).toISOString() : null, expiresAt = form.expiresAt ? new Date(form.expiresAt).toISOString() : null;
            if (expiresAt && new Date(expiresAt) <= new Date(scheduledAt || Date.now()))
                throw new Error('Expiry must be after the send time.');
            if (audience.audienceType === 'user' && !recipient)
                throw new Error('Select a patron.');
            const count = await countNotificationRecipients(audience);
            if (!count)
                throw new Error('This audience has no active recipients.');
            if (audience.audienceType !== 'user' && !await confirm({ title: scheduledAt ? 'Schedule broadcast?' : 'Send broadcast?', description: `${scheduledAt ? 'Schedule' : 'Send'} “${form.title}” for ${count.toLocaleString()} active recipients${scheduledAt ? ` on ${time(scheduledAt)}` : ''}.`, actionLabel: scheduledAt ? 'Schedule notification' : 'Send notification', cancelLabel: 'Keep editing' }))
                return;
            await createAdminNotification({ ...audience, type: form.type, title: form.title, body: form.body, href: form.href === 'none' ? null : form.href, expiresAt, scheduledAt, confirmedRecipientCount: count });
            guard.markSaved();
            setCompose(false);
            setPage(1);
            setMessage(scheduledAt ? 'Notification scheduled.' : 'Notification sent.');
            await refresh();
        }
        catch (failure) {
            setError(getApiErrorMessage(failure, 'Could not send notification.'));
            void countQuery.refetch();
        }
        finally {
            setBusy(false);
        }
    };
    const act = async (item: AdminNotification, action: 'resend' | 'expire') => {
        if (busy)
            return;
        setBusy(true);
        setError('');
        try {
            let count: number | undefined;
            if (action === 'resend')
                count = await countNotificationRecipients({ audienceType: item.audience_type, audienceRole: item.audience_role, audienceUserId: item.audience_user_id });
            if (!await confirm({ title: action === 'expire' ? 'Expire notification?' : 'Resend notification?', description: action === 'expire' ? `“${item.title}” will no longer appear in the patron feed${item.queue_id ? ' and its scheduled delivery will be cancelled' : ''}.` : `Send “${item.title}” again to ${count?.toLocaleString()} active recipients.`, actionLabel: action === 'expire' ? 'Expire notification' : 'Resend notification', tone: action === 'expire' ? 'danger' : 'default' }))
                return;
            await notificationAction(item.record_key, action, count);
            setMessage(action === 'expire' ? 'Notification expired.' : 'Resend requested.');
            await refresh();
            setDetail(null);
        }
        catch (failure) {
            setError(getApiErrorMessage(failure, 'Could not update notification.'));
        }
        finally {
            setBusy(false);
        }
    };
    const menu = (item: AdminNotification) => [{ label: 'Resend', disabled: busy || Boolean(item.queue_id && item.delivery_status !== 'failed'), onSelect: () => void act(item, 'resend') }, { label: 'Duplicate', disabled: busy, onSelect: () => open(item) }, { label: 'Expire', disabled: busy || item.delivery_status === 'expired', destructive: true, onSelect: () => void act(item, 'expire') }];
    const exportFeed = async () => {
        setExporting(true);
        setError('');
        try {
            const collected: AdminNotification[] = [];
            let index = 1;
            while (true) {
                const result = await fetchAdminNotifications({ tab, filter, q, page: index, limit: 100 });
                collected.push(...result.notifications);
                if (index >= result.pagination.totalPages)
                    break;
                index++;
            }
            const cell = (value: unknown) => '"' + String(value ?? '').replace(/^[\s]*[=+@\-]/, "'$&").replace(/"/g, '""') + '"';
            const csv = [['Title', 'Message', 'Type', 'Audience', 'Delivery', 'Read', 'Group size', 'Created', 'Scheduled', 'Expires'], ...collected.map(item => [item.title, item.body, label(item.type), item.audience_user_name || item.audience_role || 'All active users', item.delivery_status, item.group_reads || item.read_count, item.group_count || 1, time(item.created_at), time(item.scheduled_at), time(item.expires_at)])].map(row => row.map(cell).join(',')).join('\r\n');
            const url = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' }));
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = `notifications-${tab}.csv`;
            anchor.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        }
        catch (failure) {
            setError(getApiErrorMessage(failure, 'Could not export notifications.'));
        }
        finally {
            setExporting(false);
        }
    };
    const previewDestination = destinations.find(item => item[0] === form.href)?.[1];
    return <div className="notifications-workspace">
 <AdminPageHeader title="Notifications" updatedAt={query.dataUpdatedAt} loading={query.isFetching} onRefresh={() => void refresh()} actions={<><Button variant="outline" disabled={exporting || !query.data} onClick={() => void exportFeed()}><AdminIcon name="reports"/>{exporting ? 'Exporting…' : 'Export'}</Button><Button onClick={() => open()}><AdminIcon name="plus"/>New notification</Button></>}/>
 <AdminPageTabs value={tab} onChange={value => { const next = new URLSearchParams(params); next.set('tab', value); setParams(next); setPage(1); setFilter('all'); }} label="Notification pages" items={[{ value: 'announcements', label: 'Announcements', icon: 'content' }, { value: 'system', label: 'System alerts', icon: 'notifications' }]}>
 <TabsContent value={tab} className="notifications-feed">
 <AdminFilterChips label="Notification source" value={filter} onChange={value => { setFilter(value); setPage(1); }} items={[{ value: 'manual', label: 'Manual', count: counts?.manual }, { value: 'automatic', label: 'Automatic', count: counts?.automatic }, { value: 'failed', label: 'Failed', count: counts?.failed, tone: 'red' }, { value: 'all', label: 'All', count: counts?.all }]}/>
 <div className="notification-search"><AdminIcon name="search"/><Input aria-label="Search notifications" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} placeholder="Search titles, messages or patrons"/>{search && <Button variant="ghost" size="icon" aria-label="Clear search" onClick={() => { setSearch(''); setPage(1); }}><AdminIcon name="close"/></Button>}</div>
 {error && !compose && <p className="notification-feedback" role="alert">{error}</p>}{message && <p className="notification-feedback" role="status">{message}<Button variant="ghost" size="icon" aria-label="Dismiss confirmation" onClick={() => setMessage('')}><AdminIcon name="close"/></Button></p>}
 {query.isError && <div className="notification-feedback" role="alert">{getApiErrorMessage(query.error, 'Could not load notifications.')}<Button variant="outline" onClick={() => void query.refetch()}>Retry</Button></div>}
 {query.isPending ? <div aria-label="Loading notifications">{[1, 2, 3].map(n => <Skeleton key={n} className="h-20 mb-3"/>)}</div> : rows.length ? <ul className="notification-list" aria-label="Notifications" aria-busy={query.isFetching}>{rows.map(item => <li key={item.record_key} className="notification-row"><div className="notification-row-copy"><div className="notification-row-top"><span className="notification-type">{label(item.type)}</span><Audience item={item}/>{Number(item.group_count) > 1 && <span className="notification-group">{item.group_count} alerts · {formatAdminDate(item.created_at, false)}</span>}</div><button className="notification-title" onClick={() => { setError(''); setDetail(item); }}>{item.title}{Number(item.group_count) > 1 && <span className="sr-only"> · View grouped alerts</span>}</button><p className="notification-excerpt">{item.body}</p><div className="notification-meta"><time dateTime={item.created_at}>{time(item.scheduled_at || item.created_at)}</time>{item.creator_name && <span>By {item.creator_name}</span>}</div></div><Status item={item} group/><AdminRowMenu label={`Actions for ${item.title}`} items={Number(item.group_count) > 1 ? [{ label: `View ${item.group_count} alerts`, onSelect: () => setDetail(item) }] : menu(item)}/></li>)}</ul> : <div className="notification-empty"><AdminIcon name="notifications"/><h2>{q || filter !== 'all' ? 'No notifications match' : 'No notifications yet'}</h2>{q || filter !== 'all' ? <Button variant="outline" onClick={() => { setSearch(''); setFilter('all'); setPage(1); }}>Clear filters</Button> : <Button onClick={() => open()}>New notification</Button>}</div>}
 {pagination && pagination.totalPages > 1 && <nav className="notification-pagination" aria-label="Notification pages"><span>Page {page} of {pagination.totalPages}</span><Button variant="outline" disabled={page === 1 || query.isFetching} onClick={() => setPage(old => old - 1)}>Previous</Button><Button variant="outline" disabled={page >= pagination.totalPages || query.isFetching} onClick={() => setPage(old => old + 1)}>Next</Button></nav>}
 </TabsContent></AdminPageTabs>
 <AdminDetailDrawer open={compose} onClose={() => void close()} title="New notification" description="Compose a message for your patrons." className="notification-drawer" footer={<><span className="notification-footer-scope">{countQuery.isError ? 'Recipient count unavailable' : form.audienceType === 'user' && !recipient ? 'Select a patron' : countQuery.data === undefined ? 'Counting recipients…' : `${countQuery.data.toLocaleString()} recipient${countQuery.data === 1 ? '' : 's'}`}</span><Button variant="outline" disabled={busy} onClick={() => void close()}>Cancel</Button><Button type="submit" form="notification-compose" disabled={busy || countQuery.isFetching || countQuery.data === undefined || countQuery.data === 0 || (form.audienceType === 'user' && !recipient)}>{busy ? 'Processing…' : form.sendMode === 'schedule' ? 'Schedule notification' : 'Send notification'}</Button></>}>
 <form id="notification-compose" onSubmit={event => void send(event)} className="notification-compose"><fieldset disabled={busy}>
 <div className="notification-field"><label>Audience</label><Segments label="Audience" value={form.audienceType} items={[['all', 'Everyone'], ['role', 'By role'], ['user', 'Patron']]} onChange={value => { set('audienceType', value); setRecipient(null); setRecipientSearch(''); }}/></div>
 {form.audienceType === 'role' && <Field label="Audience role" id="notification-role"><Select value={form.audienceRole} onValueChange={value => set('audienceRole', value)}><SelectTrigger id="notification-role"><SelectValue /></SelectTrigger><SelectContent>{roles.map(role => <SelectItem key={role} value={role}>{label(role)}</SelectItem>)}</SelectContent></Select></Field>}
 {form.audienceType === 'user' && <Field label="Patron" id="notification-recipient">{recipient ? <div className="notification-selected"><span>{recipient.name}<small>{recipient.username || recipient.student_employee_id}</small></span><Button type="button" variant="ghost" size="icon" aria-label="Clear patron" onClick={() => setRecipient(null)}><AdminIcon name="close"/></Button></div> : <><Input id="notification-recipient" autoComplete="off" value={recipientSearch} onChange={event => setRecipientSearch(event.target.value)} placeholder="Search patron name, ID or username"/>{recipientQ.length >= 2 && <div className="notification-matches" aria-live="polite">{recipientQuery.isFetching ? 'Searching…' : recipientQuery.isError ? <p role="alert">Could not search patrons. <Button variant="outline" type="button" onClick={() => void recipientQuery.refetch()}>Retry</Button></p> : recipientQuery.data?.length ? recipientQuery.data.map(item => <button type="button" key={item.id} onClick={() => { setRecipient(item); setRecipientSearch(''); }}>{item.name}<small>{item.username || item.student_employee_id} · {label(item.role)}</small></button>) : 'No active patrons match.'}</div>}</>}</Field>}
 <Field label="Type" id="notification-type"><Select value={form.type} onValueChange={value => set('type', value)}><SelectTrigger id="notification-type"><SelectValue /></SelectTrigger><SelectContent>{types.map(([value, text]) => <SelectItem value={value} key={value}>{text}</SelectItem>)}</SelectContent></Select></Field>
 <Field label="Title" id="notification-title"><Input id="notification-title" required maxLength={200} value={form.title} onChange={event => set('title', event.target.value)} placeholder="Give your notification a clear title" aria-describedby="notification-title-count"/><span id="notification-title-count" className="notification-counter">{form.title.length} / 200</span></Field>
 <Field label="Message" id="notification-body"><Textarea id="notification-body" required maxLength={2000} rows={5} value={form.body} onChange={event => set('body', event.target.value)} placeholder="Write the message patrons will see" aria-describedby="notification-body-count"/><span id="notification-body-count" className="notification-counter">{form.body.length} / 2,000</span></Field>
 <Field label="Destination" id="notification-destination"><Select value={form.href} onValueChange={value => set('href', value)}><SelectTrigger id="notification-destination"><SelectValue /></SelectTrigger><SelectContent>{destinations.map(([value, text]) => <SelectItem key={value} value={value}>{text}</SelectItem>)}</SelectContent></Select></Field>
 <div className="notification-field"><label>Delivery</label><Segments label="Send timing" value={form.sendMode} items={[['now', 'Send now'], ['schedule', 'Schedule']]} onChange={value => set('sendMode', value)}/></div>
 {form.sendMode === 'schedule' && <AdminDateTime label="Send on" value={form.scheduledAt} onChange={value => set('scheduledAt', value)}/>}
 <AdminDateTime label="Expires (optional)" optional value={form.expiresAt} onChange={value => set('expiresAt', value)}/>
 <section className="notification-preview" aria-label="Patron preview"><h3><AdminIcon name="eye"/>Patron preview</h3><div><span className="notification-type">{label(form.type)}</span><h4>{form.title || 'Notification title'}</h4><p>{form.body || 'Your message appears here.'}</p>{form.href !== 'none' && <span className="notification-preview-link">Open {previewDestination}<AdminIcon name="external"/></span>}</div></section>
 {error && <p className="notification-feedback" role="alert">{error}</p>}{countQuery.isError && <p role="alert">Could not count recipients. <Button type="button" variant="outline" onClick={() => void countQuery.refetch()}>Retry</Button></p>}
 </fieldset></form></AdminDetailDrawer>
 <AdminDetailDrawer open={Boolean(detail)} onClose={() => setDetail(null)} title={detail?.group_count && detail.group_count > 1 ? `${label(detail.type)} · ${detail.group_count} alerts` : detail?.title || 'Notification'} description={detail ? time(detail.created_at) : 'Notification details'} className="notification-drawer" footer={detail ? <><Button variant="outline" onClick={() => setDetail(null)}>Close</Button>{Number(detail.group_count) <= 1 && <AdminRowMenu label="Notification actions" items={menu(detail)}/>}</> : undefined}>
 {error && <p role="alert" className="notification-feedback">{error}</p>}{detailQuery.isPending ? <Skeleton className="h-36"/> : detailQuery.isError ? <div role="alert">Could not load this message.<Button variant="outline" onClick={() => void detailQuery.refetch()}>Retry</Button></div> : detailQuery.data?.map(item => <article key={item.record_key} className="notification-detail"><span className="notification-type">{label(item.type)}</span><h3>{item.title}</h3><div className="notification-meta"><Audience item={item}/><span>{time(item.created_at)}</span></div><p>{item.body}</p><Status item={item}/>{item.href && <Link to={item.href} className="notification-destination">Open {destinations.find(option => option[0] === item.href)?.[1] || 'destination'}<AdminIcon name="external"/></Link>}{item.expires_at && <span className="notification-meta">Expires {time(item.expires_at)}</span>}{item.last_error && <p className="notification-feedback">Delivery failed. Resend to retry.</p>}{Number(detail?.group_count) > 1 && <AdminRowMenu label={`Actions for ${item.title}`} items={menu(item)}/>}</article>)}{Number(detail?.group_count) > 100 && <p className="notification-meta">Showing the latest 100 messages in this group.</p>}
 </AdminDetailDrawer>{confirmDialog}{guard.discardDialog}
 </div>;
}
