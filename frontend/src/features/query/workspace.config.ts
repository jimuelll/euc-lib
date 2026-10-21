import type { QueryMeta } from './api';
export type Filters = Record<string, string | number>;
export const reports = [
    { value: 'date_due', label: 'Date Due', group: 'Circulation', icon: 'circulation', description: 'Current loans due within the selected period.', filters: [] },
    { value: 'fined', label: 'Fines', group: 'Circulation', icon: 'fines', description: 'Charges, payments, adjustments, and outstanding balances.', filters: [] },
    { value: 'daily_users', label: 'Daily Library Users', group: 'Visitors', icon: 'attendance', description: 'Unique patrons and physical check-ins by day.', filters: [] },
    { value: 'daily_stats', label: 'Statistics for Daily Users', group: 'Visitors', icon: 'attendance', description: 'Daily attendance and average check-ins per patron.', filters: [] },
    { value: 'holdings_inventory', label: 'Holdings Inventory', group: 'Collection', icon: 'catalog', description: 'Current physical copies, accession details and lending eligibility.', filters: ['program', 'completion', 'status'], snapshot: true },
    { value: 'resource_usage', label: 'Statistics for Resource Usage', group: 'Collection', icon: 'catalog', description: 'Borrowing demand by title and saved loan policy.', filters: [] },
    { value: 'top_users', label: 'Top 10 Users', group: 'Patrons', icon: 'users', description: 'Rank patrons by borrowings or library check-ins.', filters: ['ranking'] },
];
export const datasets = [
    { value: 'catalog', label: 'Catalog', description: 'Titles, materials, copy condition and lending availability.', filters: ['materialType', 'bookType', 'category', 'availability', 'condition'] },
    { value: 'users', label: 'Users', description: 'Patron identities, roles and account access.', filters: ['role', 'accountStatus', 'program'] },
    { value: 'borrowings', label: 'Borrowings', description: 'Loans, due dates, returns and saved loan policies.', filters: ['status', 'borrowerRole', 'bookType', 'issuedBy'] },
    { value: 'reservations', label: 'Reservations', description: 'Requests, prepared copies and reservation outcomes.', filters: ['status', 'bookType'] },
    { value: 'attendance', label: 'Attendance', description: 'Recorded check-ins, check-outs and borrowing scans.', filters: ['purpose', 'scanType'] },
    { value: 'notifications', label: 'Notifications', description: 'Announcements and alerts by audience and status.', filters: ['audience', 'notificationStatus'] },
    { value: 'subscriptions', label: 'Academic subscriptions', description: 'Research resources by category and publication status.', filters: ['category', 'subscriptionStatus'] },
    { value: 'clearance', label: 'Clearance exceptions', description: 'Current overdue returns and live outstanding fine balances.', filters: ['clearanceReason'], snapshot: true },
];
export const labels: Record<string, string> = { materialType: 'Material type', bookType: 'Book type', category: 'Category', availability: 'Availability', condition: 'Copy condition', role: 'Role', borrowerRole: 'Borrower role', accountStatus: 'Account status', program: 'Program / course', status: 'Status', issuedBy: 'Issued by', purpose: 'Purpose', scanType: 'Scan type', audience: 'Audience', notificationStatus: 'Notification status', subscriptionStatus: 'Subscription status', clearanceReason: 'Reason', ranking: 'Rank users by', completion: 'Holdings details', dateFrom: 'From', dateTo: 'To', search: 'Search' };
export const human = (value: unknown) => String(value ?? '').replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
export function options(key: string, type: string, meta?: QueryMeta) { const strings = (values: string[]) => values.map(value => ({ value, label: human(value) })); const names = (values: {
    id: number;
    name: string;
}[]) => values.map(item => ({ value: String(item.id), label: item.name })); switch (key) {
    case 'materialType': return strings(['book', 'thesis']);
    case 'bookType': return names(meta?.bookTypes || []);
    case 'category': return (type === 'subscriptions' ? meta?.subscriptionCategories : meta?.categories)?.map(c => ({ value: c.value, label: c.value })) || [];
    case 'program': return names(meta?.programs || []);
    case 'issuedBy': return names(meta?.issuers || []);
    case 'role':
    case 'borrowerRole': return strings(meta?.roles || []);
    case 'accountStatus':
    case 'subscriptionStatus': return [{ value: '1', label: 'Active' }, { value: '0', label: 'Inactive' }];
    case 'status': return strings(type === 'borrowings' ? ['borrowed', 'overdue', 'returned'] : type === 'holdings_inventory' ? ['available', 'borrowed', 'reserved', 'needs_accession', 'voided', 'inactive', 'damaged', 'lost', 'unavailable'] : ['pending', 'ready', 'fulfilled', 'cancelled', 'expired']);
    case 'purpose': return [{ value: 'entry_exit', label: 'Entry / exit' }, { value: 'borrowing', label: 'Borrowing' }];
    case 'scanType': return strings(['check_in', 'check_out']);
    case 'audience': return [{ value: 'public', label: 'All users' }, { value: 'user', label: 'Individual user' }, { value: 'role', label: 'Role' }];
    case 'notificationStatus': return strings(['active', 'inactive', 'expired']);
    case 'clearanceReason': return [{ value: 'overdue', label: 'Overdue returns' }, { value: 'fines', label: 'Unpaid fines' }, { value: 'both', label: 'Both' }];
    case 'ranking': return [{ value: 'borrowings', label: 'Most borrowings' }, { value: 'checkins', label: 'Most library check-ins' }];
    case 'completion': return [{ value: 'complete', label: 'Accessioned' }, { value: 'missing', label: 'Needs accession' }];
    case 'availability': return strings(['available', 'unavailable']);
    case 'condition': return strings(['good', 'damaged', 'lost', 'weeded', 'discarded']);
    default: return [];
} }

export const defaultColumnKeys: Record<string, string[]> = {
    catalog: ['title','author','category','isbn','availableCopies','needsAccessionCopies','createdAt'],
    fined: ['borrower','title','chargedAt','assessedAmount','paidAmount','outstandingAmount','status'],
    holdings_inventory: ['title','barcode','accessionNumber','program','location','price','circulationState'],
};
