import NotificationComposeDrawer from './NotificationComposeDrawer';
import {NotificationImage} from '../NotificationReader';
import '@/features/admin/compact-admin.css';
import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Link, useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { TabsContent } from '@/components/ui/tabs';
import { AdminPageHeader, AdminPageTabs, AdminFilterChips, AdminDetailDrawer, AdminRowMenu, AdminIcon, AdminStatusBadge, useAdminConfirmDialog, useAdminUrlState } from '@/features/admin';
import { formatAdminDate } from '@/features/admin';
import { useDebounce } from '@/hooks/use-debounce';
import { getApiErrorMessage } from '@/utils/apiError';
import { notificationKeys } from '../notifications.keys';
import { fetchAdminNotifications, countNotificationRecipients, notificationAction, notificationDetails, type AdminNotification } from './api';
import { NotificationEmailResults } from './NotificationEmailOptions';
import './notifications.css';
const types = [['announcement', 'Announcement'], ['reminder', 'Reminder'], ['reservation_ready', 'Reservation ready'], ['reservation_cancelled', 'Reservation cancelled'], ['overdue_fine', 'Overdue fine']];
const destinations = [['none', 'No link'], ['/my-library', 'My Library'], ['/bulletin', 'Bulletin'], ['/services/borrowing', 'Borrowing services'], ['/catalogue', 'Catalogue']];
const label = (value: string) => types.find(item => item[0] === value)?.[1] || value.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase());
const time = (value: string | null) => value ? formatAdminDate(value) : '—';
function Audience({ item }: {
    item: AdminNotification;
}) { if(item.audience_type==='users')return <span>{item.audience_users?.map(user=>user.name).join(', ') || `${item.audience_user_ids?.length || 0} specific patrons`}</span>; const patron = item.audience_user_patron_id; return item.audience_type === 'user' ? <Link className="notification-patron" to={`/admin/manage?q=${encodeURIComponent(patron || String(item.audience_user_id))}&status=all${patron ? `&patron=${encodeURIComponent(patron)}` : ''}`}>{item.audience_user_name || 'Patron'}</Link> : <span>{item.audience_type === 'all' ? 'All active users' : label(item.audience_role || 'role')}</span>; }
function Status({ item }: {
    item: AdminNotification;
}) { return <div className="notification-delivery"><AdminStatusBadge status={item.delivery_status === 'failed' ? 'blocked' : item.delivery_status === 'available' ? 'ready' : item.delivery_status === 'expired' ? 'expired' : 'pending'}>{item.delivery_status==='available'?'Published':label(item.delivery_status)}</AdminStatusBadge></div>; }
export default function AdminNotifications() {
 const emailParentLocation=useLocation();
    const { user } = useAuth();
    const client = useQueryClient(), [params, patchUrl] = useAdminUrlState();
    const tab = params.get('tab') === 'system' ? 'system' : 'announcements';
    const [compose,setCompose]=useState(false),[composeItem,setComposeItem]=useState<AdminNotification|null>(null),[detail,setDetail]=useState<AdminNotification|null>(null),[busy,setBusy]=useState(false),[exporting,setExporting]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
    const filter=['manual','automatic','failed'].includes(params.get('filter') || '')?params.get('filter')!:'all',search=params.get('q') || '',page=Math.max(1,Math.floor(Number(params.get('page'))) || 1);
    const patch=(changes:Record<string,string>)=>patchUrl(changes,true);
    const setFilter=(value:string)=>patch({filter:value==='all'?'':value,page:''});
    const setSearch=(value:string)=>patch({q:value,page:''});
    const setPage=(value:number|((previous:number)=>number))=>patch({page:String(typeof value==='function'?value(page):value)});
    const { confirm, confirmDialog } = useAdminConfirmDialog();
    const q = useDebounce(search, 250);
    const query = useQuery({ queryKey: [...notificationKeys.adminLists(), { tab, filter, q, page }], queryFn: ({ signal }) => fetchAdminNotifications({ tab, filter, q, page }, signal), placeholderData:(previous,previousQuery)=>(previousQuery?.queryKey.at(-1) as {tab?:string}|undefined)?.tab===tab?previous:undefined });
    const detailQuery = useQuery({ queryKey: [...notificationKeys.admin(), 'detail', detail?.record_key], queryFn: ({ signal }) => notificationDetails(detail!.record_key, signal), enabled: Boolean(detail),refetchInterval:30_000 });
    const rows = query.data?.notifications || [], pagination = query.data?.pagination, counts = query.data?.counts;
    const open = (item?:AdminNotification)=>{setComposeItem(item || null);setDetail(null);setError('');setCompose(true);};
    const refresh = async () => { await client.invalidateQueries({ queryKey: notificationKeys.all }); };
    const act = async (item: AdminNotification, action: 'resend' | 'expire') => {
        if (action==='resend' && !item.queue_id) {open(item);return;}
        if (busy)
            return;
        setBusy(true);
        setError('');
        try {
            let count: number | undefined;
            if (action === 'resend')
                count = await countNotificationRecipients({ audienceType: item.audience_type, audienceRole: item.audience_role, audienceUserId: item.audience_user_id, audienceUserIds:item.audience_user_ids });
            if (!await confirm({ title: action === 'expire' ? 'Expire notification?' : 'Resend notification?', description: action === 'expire' ? `“${item.title}” will no longer appear in the patron feed. Unsent notification emails will be cancelled${item.queue_id ? ' and its scheduled delivery will be cancelled' : ''}.` : `Send “${item.title}” again to ${count?.toLocaleString()} active recipients.`, actionLabel: action === 'expire' ? 'Expire notification' : 'Resend notification', tone: action === 'expire' ? 'danger' : 'default' }))
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
            const cell = (value: unknown) => '"' + String(value ?? '').replace(/^[\s]*[=+@-]/, "'$&").replace(/"/g, '""') + '"';
            const csv = [['Title', 'Message', 'Type', 'Audience', 'Delivery', 'Read', 'Group size', 'Created', 'Scheduled', 'Expires','Image URL','Image description'], ...collected.map(item => [item.title, item.body, label(item.type), item.audience_type==='users' ? item.audience_users?.map(user=>`${user.name} (${user.id})`).join('; ') || item.audience_user_ids?.join('; ') : item.audience_user_name || item.audience_role || 'All active users', item.delivery_status, item.group_reads || item.read_count, item.group_count || 1, time(item.created_at), time(item.scheduled_at), time(item.expires_at),item.image_url || '',item.image_alt || ''])].map(row => row.map(cell).join(',')).join('\r\n');
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
    return <div className="notifications-workspace notifications-ledger-workspace">
 <AdminPageHeader title="Notifications" updatedAt={query.dataUpdatedAt} loading={query.isFetching} onRefresh={() => void refresh()} actions={<>{user?.role === 'super_admin' && <Button asChild variant="outline"><Link to="/admin/library-emails?tab=manual" state={{returnTo:emailParentLocation.pathname+emailParentLocation.search}}>Library emails</Link></Button>}<Button variant="outline" disabled={exporting || !query.data} onClick={() => void exportFeed()}><AdminIcon name="reports"/>{exporting ? 'Exporting…' : 'Export'}</Button><Button onClick={() => open()}><AdminIcon name="plus"/>New notification</Button></>}/>
 <AdminPageTabs value={tab} onChange={value => { patch({tab:value,page:'',filter:''}); }} label="Notification pages" items={[{ value: 'announcements', label: 'Announcements', icon: 'content' }, { value: 'system', label: 'System alerts', icon: 'notifications' }]}>
 <TabsContent value={tab} className="notifications-feed">
 <AdminFilterChips label="Notification source" value={filter} onChange={value => { setFilter(value); setPage(1); }} items={[{ value: 'manual', label: 'Manual', count: counts?.manual }, { value: 'automatic', label: 'Automatic', count: counts?.automatic }, { value: 'failed', label: 'Failed', count: counts?.failed, tone: 'red' }, { value: 'all', label: 'All', count: counts?.all }]}/>
 <div className="notification-search"><AdminIcon name="search"/><Input aria-label="Search notifications" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} placeholder="Search titles, messages or patrons"/>{search && <Button variant="ghost" size="icon" aria-label="Clear search" onClick={() => { setSearch(''); setPage(1); }}><AdminIcon name="close"/></Button>}</div>
 {error && !compose && <p className="notification-feedback" role="alert">{error}</p>}{message && <p className="notification-feedback" role="status">{message}<Button variant="ghost" size="icon" aria-label="Dismiss confirmation" onClick={() => setMessage('')}><AdminIcon name="close"/></Button></p>}
 {query.isError && <div className="notification-feedback" role="alert">{getApiErrorMessage(query.error, 'Could not load notifications.')}<Button variant="outline" onClick={() => void query.refetch()}>Retry</Button></div>}
 {query.isPending ? <div aria-label="Loading notifications">{[1, 2, 3].map(n => <Skeleton key={n} className="h-20 mb-3"/>)}</div> : rows.length ? <div className="notification-ledger-region" role="region" aria-label="Notification records"><table className="notification-ledger"><caption className="sr-only">Notifications and publication status. Read counts refer to in-app reads.</caption><thead><tr>{['Notification','Audience','Delivery','Published / Scheduled','In-app reads','Actions'].map(text=><th key={text} scope="col">{text}</th>)}</tr></thead><tbody>{rows.map(item=><tr key={item.record_key}><td data-label="Notification"><button className="notification-ledger-title" style={{fontFamily:"var(--font-heading)"}} onClick={()=>{setError('');setDetail(item);}}>{Number(item.group_count)>1?`${label(item.type)} · ${item.group_count} alerts`:item.title}</button><p className="notification-ledger-excerpt">{Number(item.group_count)>1?'Grouped automatic alerts. Open to inspect individual messages.':item.body}</p><span className="notification-ledger-meta">{label(item.origin)} · {label(item.type)}{item.image_url&&<span><AdminIcon name="image"/>Image included</span>}</span></td><td data-label="Audience"><Audience item={item}/></td><td data-label="Delivery"><Status item={item}/>{Boolean(item.email_requested)&&<span className="notification-ledger-meta">Email requested</span>}</td><td data-label="Published / Scheduled"><time dateTime={item.scheduled_at || item.created_at}>{time(item.scheduled_at || item.created_at)}</time></td><td data-label="In-app reads" className="notification-read-count">{item.delivery_status==='available'||item.delivery_status==='expired'?Number((Number(item.group_count)>1?item.group_reads:item.read_count) || 0).toLocaleString():'—'}</td><td><AdminRowMenu label={`Actions for ${item.title}`} items={Number(item.group_count)>1?[{label:`View ${item.group_count} alerts`,onSelect:()=>setDetail(item)}]:[{label:'View details',onSelect:()=>setDetail(item)},...menu(item)]}/></td></tr>)}</tbody></table></div> : <div className="notification-empty"><AdminIcon name="notifications"/><h2>{q || filter !== 'all' ? 'No notifications match' : 'No notifications yet'}</h2>{q || filter !== 'all' ? <Button variant="outline" onClick={() => { setSearch(''); setFilter('all'); setPage(1); }}>Clear filters</Button> : <Button onClick={() => open()}>New notification</Button>}</div>}
 {pagination && pagination.totalPages > 1 && <nav className="notification-pagination" aria-label="Notification pages"><span>Page {page} of {pagination.totalPages}</span><Button variant="outline" disabled={page === 1 || query.isFetching} onClick={() => setPage(old => old - 1)}>Previous</Button><Button variant="outline" disabled={page >= pagination.totalPages || query.isFetching} onClick={() => setPage(old => old + 1)}>Next</Button></nav>}
 </TabsContent></AdminPageTabs>
 {compose && <NotificationComposeDrawer initial={composeItem} onClose={()=>setCompose(false)} onSent={async text=>{setPage(1);setMessage(text);await refresh();}}/>}
 <AdminDetailDrawer open={Boolean(detail)} onClose={() => setDetail(null)} title={detail?.group_count && detail.group_count > 1 ? `${label(detail.type)} · ${detail.group_count} alerts` : detail?.title || 'Notification'} description={detail ? time(detail.created_at) : 'Notification details'} className="notification-drawer" footer={detail ? <><Button variant="outline" onClick={() => setDetail(null)}>Close</Button>{Number(detail.group_count) <= 1 && <AdminRowMenu label="Notification actions" items={menu(detail)}/>}</> : undefined}>
 {error && <p role="alert" className="notification-feedback">{error}</p>}{detailQuery.isPending ? <Skeleton className="h-36"/> : detailQuery.isError ? <div role="alert">Could not load this message.<Button variant="outline" onClick={() => void detailQuery.refetch()}>Retry</Button></div> : detailQuery.data?.map(item => <article key={item.record_key} className="notification-detail"><span className="notification-type">{label(item.type)}</span><h3>{item.title}</h3><div className="notification-meta"><Audience item={item}/><span>{time(item.created_at)}</span></div><p>{item.body}</p><NotificationImage key={item.image_url} url={item.image_url} alt={item.image_alt}/><Status item={item}/>{Boolean(item.email_requested) && <NotificationEmailResults summary={item.email_summary} deadline={item.email_expires_at} scheduled={Boolean(item.queue_id)}/ >}{item.href && <Link to={item.href} className="notification-destination">Open {destinations.find(option => option[0] === item.href)?.[1] || 'destination'}<AdminIcon name="external"/></Link>}{item.expires_at && <span className="notification-meta">Expires {time(item.expires_at)}</span>}{item.last_error && <p className="notification-feedback">Delivery failed. Resend to retry.</p>}{Number(detail?.group_count) > 1 && <AdminRowMenu label={`Actions for ${item.title}`} items={menu(item)}/>}</article>)}{Number(detail?.group_count) > 100 && <p className="notification-meta">Showing the latest 100 messages in this group.</p>}
 </AdminDetailDrawer>{confirmDialog}
 </div>;
}
