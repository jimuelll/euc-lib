// @vitest-environment jsdom
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {render,screen,fireEvent,waitFor,within,cleanup} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {MemoryRouter,useLocation} from 'react-router-dom';
import {createTestQueryClientWrapper} from '@/test-utils/query-client';
import AdminAuditLogs from './AdminAuditLogs';
import * as api from '../../api/adminAnalytics.api';
import {changesOf,valueText,dayKey} from '../audit-log';
vi.mock('../../api/adminAnalytics.api',()=>({fetchAuditLogs:vi.fn(),fetchAuditMeta:vi.fn(),exportAuditLogs:vi.fn()}));
const row={id:12,occurred_at:'2026-10-09T02:00:00Z',category:'catalog',action:'updated',actor_name:'Library Staff',actor_role:'super_admin',description:'Updated Circulation policy',route:'/api/admin/book-types/1',metadata:{changes:[{field:'Fine',before:0,after:3},{field:'Policy name',before:'General',after:'Circulation'}]},restore_status:'retained' as const,reversed_at:null,target:{kind:'Policy',label:'Circulation',url:'/admin/book-types?policyId=1'}};
function mount(url='/admin/audit-logs'){function Location(){return <output data-testid="url">{useLocation().search}</output>;}render(<MemoryRouter initialEntries={[url]}><AdminAuditLogs/><Location/></MemoryRouter>,{wrapper:createTestQueryClientWrapper()});}
beforeEach(()=>{vi.clearAllMocks();vi.mocked(api.fetchAuditLogs).mockResolvedValue({rows:[row],pagination:{page:1,limit:20,total:1,totalPages:1},filters:{category:'all',action:'',dateFrom:'',dateTo:''},unfilteredTotal:109,latestId:12});vi.mocked(api.fetchAuditMeta).mockResolvedValue({categories:['auth','catalog'],actions:['login','updated'],actionsByCategory:{catalog:['updated'],auth:['login']},actors:[{id:1,name:'Staff'}]});});afterEach(cleanup);
it('expands compact changes and keeps IDs and routes behind Details',async()=>{
 mount();const event=await screen.findByRole('article',{name:/Event 12/});
 expect(within(event).queryByRole('button',{name:'Copy event ID 12'})).not.toBeInTheDocument();
 fireEvent.click(within(event).getByRole('button',{name:/View details/}));
 expect(within(event).getByRole('list',{name:'Recorded field changes'})).toHaveTextContent(/Fine:.*0.00.*3.00/);
 expect(within(event).queryByText('Before')).not.toBeInTheDocument();
 const details=within(event).getByText('Details').closest('details')!;
 expect(details).not.toHaveAttribute('open');
 expect(within(event).getByText('Captured route')).not.toBeVisible();
 fireEvent.click(within(event).getByText('Details'));
 expect(details).toHaveAttribute('open');
 expect(within(event).getByRole('button',{name:'Copy event ID 12'})).toBeVisible();
 expect(within(event).getByText('Captured route')).toBeVisible();
});
it('restores deep filters and narrows action options by category',async()=>{mount('/admin/audit-logs?category=catalog&record=%2Fapi%2Fadmin%2Fbook-types%2F1');await screen.findByRole('article',{name:/Event 12/});expect(api.fetchAuditLogs).toHaveBeenCalledWith(expect.objectContaining({category:'catalog',record:'/api/admin/book-types/1'}),expect.anything());fireEvent.click(screen.getByRole('button',{name:/^Filters/}));const actions=await screen.findByLabelText('Action');expect(within(actions).queryByText('Signed in')).not.toBeInTheDocument();fireEvent.change(screen.getByLabelText('Category'),{target:{value:'auth'}});expect(screen.getByTestId('url')).toHaveTextContent('category=auth');expect(within(actions).getByText('Signed in')).toBeInTheDocument();});
it('applies debounced search to the URL without an Apply action',async()=>{mount();await screen.findByRole('article',{name:/Event 12/});fireEvent.change(screen.getByRole('searchbox',{name:'Search audit events'}),{target:{value:'Circulation'}});await waitFor(()=>expect(screen.getByTestId('url')).toHaveTextContent('query=Circulation'),{timeout:3000});expect(screen.getByRole('button',{name:'Remove query filter'})).toBeInTheDocument();});
it('keeps expansion on refresh with a single bottom pager',async()=>{mount();await screen.findByRole('article',{name:/Event 12/});fireEvent.click(screen.getByRole('button',{name:'Expand all'}));await waitFor(()=>expect(screen.getByRole('button',{name:'Refresh'})).toBeEnabled());fireEvent.click(screen.getByRole('button',{name:'Refresh'}));await waitFor(()=>expect(screen.getByRole('button',{name:/Hide details/})).toBeInTheDocument());expect(screen.queryByLabelText('Top rows per page')).not.toBeInTheDocument();expect(screen.getByLabelText('Bottom rows per page')).toBeInTheDocument();});
it('does not invent historical values and uses the reporting timezone',()=>{expect(valueText('Changed')).toBe('Not recorded (legacy event)');expect(changesOf(row)[0].before).toBe(0);expect(dayKey('2026-10-08T20:00:00Z')).toBe('2026-10-09');});

it('shows redacted field names and keeps revealing unavailable',async()=>{vi.mocked(api.fetchAuditLogs).mockResolvedValue({rows:[{...row,metadata:{changes:[{field:'Name',before:'Redacted (sensitive)',after:'Redacted (sensitive)'},{field:'Email',before:'Redacted (sensitive)',after:'Redacted (sensitive)'}]}}],pagination:{page:1,limit:20,total:1,totalPages:1},filters:{category:'all',action:'',dateFrom:'',dateTo:''},latestId:12});mount();await screen.findByRole('article',{name:/Event 12/});fireEvent.click(screen.getByRole('button',{name:/View details/}));expect(screen.getAllByText(/Changed · values hidden/)).toHaveLength(2);});
it('does not show a new-events banner for an ID change without a matching count',async()=>{vi.mocked(api.fetchAuditLogs).mockImplementation(async args=>({rows:args.limit===1?[]:[row],pagination:{page:1,limit:args.limit,total:1,totalPages:1},filters:{category:'all',action:'',dateFrom:'',dateTo:''},latestId:args.limit===1?99:12}));mount();await screen.findByRole('article',{name:/Event 12/});expect(screen.queryByRole('button',{name:'Dismiss new events notice'})).not.toBeInTheDocument();});
it('dismisses a counted new-events notice',async()=>{vi.mocked(api.fetchAuditLogs).mockImplementation(async args=>({rows:args.limit===1?[]:[row],pagination:{page:1,limit:args.limit,total:args.limit===1?4:1,totalPages:1},filters:{category:'all',action:'',dateFrom:'',dateTo:''},latestId:args.limit===1?99:12}));mount();expect(await screen.findByText('3 events newly available')).toBeInTheDocument();fireEvent.click(screen.getByRole('button',{name:'Dismiss new events notice'}));expect(screen.queryByText('3 events newly available')).not.toBeInTheDocument();});
it('filters using full-result quick counts and exposes a removable filter',async()=>{vi.mocked(api.fetchAuditLogs).mockResolvedValue({rows:[row],pagination:{page:1,limit:20,total:1,totalPages:1},filters:{category:'all',action:'',dateFrom:'',dateTo:''},quickCounts:{money:7,mine:4}});mount();fireEvent.click(await screen.findByRole('button',{name:'Money 7'}));expect(screen.getByTestId('url')).toHaveTextContent('quick=money');expect(screen.getByRole('button',{name:'Remove quick filter'})).toBeInTheDocument();});
it('defaults all events to collapsed with a visible high-impact dot and label',async()=>{
 vi.mocked(api.fetchAuditLogs).mockResolvedValue({rows:[{...row,metadata:{},target:undefined},{...row,id:13,significant:true,metadata:{reason:'Redacted (sensitive)',changes:[{field:'Fine',before:1,after:2}]}}],pagination:{page:1,limit:20,total:2,totalPages:1},filters:{category:'all',action:'',dateFrom:'',dateTo:''}});
 mount();
 const empty=await screen.findByRole('article',{name:/Event 12/});
 expect(within(empty).queryByRole('button',{name:/View details/})).not.toBeInTheDocument();
 const impact=screen.getByRole('article',{name:/Event 13/});
 expect(within(impact).getByRole('button',{name:/View details/})).toHaveAttribute('aria-expanded','false');
 expect(within(impact).getByText('High impact')).toBeVisible();
 expect(impact.querySelector('.audit-impact-dot')).toHaveAttribute('aria-hidden','true');
 expect(screen.getByRole('button',{name:'Expand all'})).toBeEnabled();
 expect(screen.getByRole('button',{name:'Collapse all'})).toBeDisabled();
 fireEvent.click(within(impact).getByRole('button',{name:/View details/}));
 expect(await screen.findByText(/Recorded .* values hidden for privacy/)).toBeVisible();
});

it('shows readable schema changes with field keys and user agent in Details',async()=>{
 vi.mocked(api.fetchAuditLogs).mockResolvedValue({rows:[{...row,route:'/api/admin/catalog-schema',metadata:{user_agent:'Audit test browser',changes:[{field:'Physical description (physical_description) \u00b7 public',before:'Yes',after:'No'}]}}],pagination:{page:1,limit:20,total:1,totalPages:1},filters:{category:'all',action:'',dateFrom:'',dateTo:''}});
 mount();await screen.findByRole('article',{name:/Event 12/});fireEvent.click(screen.getByRole('button',{name:/View details/}));
 const changes=screen.getByRole('list',{name:'Recorded field changes'});
 expect(changes).toHaveTextContent('Physical description \u00b7 public: Yes \u2192 to No');
 expect(changes).not.toHaveTextContent('physical_description');
 expect(screen.getByText('Audit test browser')).not.toBeVisible();
 fireEvent.click(screen.getByText('Details'));
 expect(screen.getByText('Audit test browser')).toBeVisible();
 expect(screen.getByRole('link',{name:'physical_description'})).toHaveAttribute('href','/admin/catalog?tab=builder&fieldKey=physical_description');
});


it('moves test-only filtering into View and restores default authentication visibility on reset',async()=>{
 mount('/admin/audit-logs?actor=6');await screen.findByRole('article',{name:/Event 12/});
 expect(api.fetchAuditLogs).toHaveBeenCalledWith(expect.objectContaining({actor:'6',showRoutineAuth:''}),expect.anything());
 expect(within(screen.getByRole('group',{name:'Quick audit filters'})).queryByRole('button',{name:/Test accounts/})).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'View'}));
 const auth=screen.getByRole('checkbox',{name:'Show sign-ins and sign-outs'});expect(auth).not.toBeChecked();
 fireEvent.click(auth);expect(screen.getByTestId('url')).toHaveTextContent('showRoutineAuth=true');
 fireEvent.click(screen.getByRole('checkbox',{name:'Test accounts only'}));expect(screen.getByTestId('url')).toHaveTextContent('quick=test');
 fireEvent.click(screen.getByRole('button',{name:'Reset filters'}));expect(auth).not.toBeChecked();expect(screen.getByTestId('url')).not.toHaveTextContent('actor=6');
});
it('Auth explicitly includes routine events and supports old test quick links',async()=>{
 mount('/admin/audit-logs?quick=test');await screen.findByRole('article',{name:/Event 12/});
 fireEvent.click(screen.getByRole('button',{name:'View'}));expect(screen.getByRole('checkbox',{name:'Test accounts only'})).toBeChecked();
 fireEvent.click(screen.getByRole('button',{name:/^Auth /}));expect(screen.getByTestId('url')).toHaveTextContent('quick=auth');expect(screen.getByTestId('url')).toHaveTextContent('showRoutineAuth=true');
});


it('groups View settings in layout, visibility and saved-view order without the routine-auth notice',async()=>{
 mount();await screen.findByRole('article',{name:/Event 12/});
 expect(screen.queryByText(/Routine sign-ins and sign-outs are hidden/)).not.toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'View'}));
 const settings=screen.getByRole('group',{name:'Audit view settings'});
 expect(Array.from(settings.querySelectorAll('fieldset>legend')).map(el=>el.textContent)).toEqual(['Layout','Event visibility','Saved views']);
 const controls=Array.from(settings.querySelectorAll('select,input,button'));
 expect(controls.map(el=>el.getAttribute('aria-label')||el.closest('label')?.textContent||el.textContent)).toEqual(['Row density','Actor','Category','Time','Record','Show sign-ins and sign-outs','Test accounts only','Saved audit view','Saved view name','Save view']);
});
it('keeps a decorative marker next to time for significant and ordinary events',async()=>{
 mount();const event=await screen.findByRole('article',{name:/Event 12/});
 const gutter=event.querySelector('.audit-time-gutter')!;
 expect(gutter.querySelector('.audit-event-marker')).toHaveAttribute('aria-hidden','true');expect(gutter.querySelector('time')).toBeInTheDocument();
 fireEvent.click(within(event).getByRole('button',{name:/View details/}));
 expect(event.querySelector('.audit-time-gutter')).toBe(gutter);
});
