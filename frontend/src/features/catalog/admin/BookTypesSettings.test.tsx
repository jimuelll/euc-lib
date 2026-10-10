// @vitest-environment jsdom
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {MemoryRouter} from 'react-router-dom';
import BookTypesSettings from './BookTypesSettings';
import * as api from './catalog.api';
import {createTestQueryClientWrapper} from '@/test-utils/query-client';
import {adminInstant,adminUpdatedTime} from '@/utils/adminInstant';
import {policyDraft,policyErrors,finePreview,loanDuration} from './book-type-policy';
vi.mock('./catalog.api',()=>({createBookType:vi.fn(),deleteBookType:vi.fn(),fetchBookTypes:vi.fn(),updateBookType:vi.fn()}));
const policy:api.BookType={id:7,name:'General collection',default_borrow_days:7,loan_duration_minutes:10080,loan_duration_unit:'day',fine_per_hour:1,fine_interval:'hour',initial_fine:0,is_active:1,assigned_active_books:2,assigned_archived_books:1};
afterEach(cleanup);
function mount(){return render(<MemoryRouter><BookTypesSettings/></MemoryRouter>,{wrapper:createTestQueryClientWrapper()});}
describe('book type policies',()=>{
 beforeEach(()=>{vi.clearAllMocks();vi.mocked(api.fetchBookTypes).mockResolvedValue([policy]);vi.mocked(api.updateBookType).mockResolvedValue(policy);});
 it('shows readable units, currency, fine arithmetic and an exact Catalog link',async()=>{
  mount();expect(await screen.findByText('7 days')).toBeInTheDocument();
  expect(screen.getByText('₱0.00 when overdue, then ₱1.00 per hour')).toBeInTheDocument();
  const example=screen.getByText(/Overdue by 3 hours = ₱3.00/);expect(example.closest('details')).not.toHaveAttribute('open');fireEvent.click(screen.getByText('Fine example'));expect(example).toHaveTextContent('Example:');
  expect(screen.getByRole('link',{name:/3 books/})).toHaveAttribute('href','/admin/catalog?tab=records&bookTypeId=7&status=all');
 });
 it('only enables Save after a valid edit and saves whole minutes',async()=>{
  mount();fireEvent.click(await screen.findByRole('button',{name:'Edit General collection'}));
  const dialog=screen.getByRole('dialog');expect(within(dialog).getByRole('button',{name:'Save changes'})).toBeDisabled();
  fireEvent.change(within(dialog).getByLabelText(/Loan duration/),{target:{value:'8'}});
  expect(within(dialog).getByText(/General collection · Unsaved changes/)).toBeInTheDocument();
  fireEvent.change(within(dialog).getByLabelText('Reason for change *'),{target:{value:'Annual policy review'}});fireEvent.click(within(dialog).getByRole('button',{name:'Save changes'}));
  await waitFor(()=>expect(api.updateBookType).toHaveBeenCalledWith(7,expect.objectContaining({loan_duration_minutes:11520})));
 });
 it('blocks duplicate names inline and retains the existing policy',async()=>{
  mount();await screen.findByText('General collection');fireEvent.click(screen.getByRole('button',{name:'Add book type'}));
  const dialog=screen.getByRole('dialog'),name=within(dialog).getByLabelText(/Type name/);
  fireEvent.change(name,{target:{value:' general COLLECTION '}});fireEvent.blur(name);
  expect(within(dialog).getByText('A book type with this name already exists.')).toBeInTheDocument();
  expect(within(dialog).getByRole('button',{name:'Add book type'})).toBeDisabled();expect(api.createBookType).not.toHaveBeenCalled();
 });
 it('links old-term loans and the matching audit event without inventing an actor',async()=>{
  vi.mocked(api.fetchBookTypes).mockResolvedValue([{...policy,previous_terms_loans:2,active_loans:3,last_audit_event_id:108,last_changed_at:'2026-10-09 01:47:34',last_changed_by:'Librarian'}]);
  mount();expect(await screen.findByRole('link',{name:/2 active loans still use previous terms/})).toHaveAttribute('href','/admin/circulation?tab=history&filter=needs_action&policyId=7&previousTerms=true');
  expect(screen.getByRole('link',{name:/Updated Oct 9, 2026, 1:47 AM · by Librarian/})).toHaveAttribute('href','/admin/audit-logs?event=108');
  fireEvent.click(screen.getByRole('button',{name:'Edit General collection'}));fireEvent.change(within(screen.getByRole('dialog')).getByLabelText(/Loan duration/),{target:{value:'14'}});
  const impact=screen.getByRole('region',{name:'Impact before saving'});expect(within(impact).getByText('7 days')).toBeInTheDocument();expect(within(impact).getByText('14 days')).toBeInTheDocument();expect(within(impact).getByText(/3 active loans keep their saved/)).toBeInTheDocument();
 });
 it('sorts by actual duration and offers restoration in Archived',async()=>{
  vi.mocked(api.fetchBookTypes).mockResolvedValue([policy,{...policy,id:8,name:'Short loan',loan_duration_minutes:60,loan_duration_unit:'hour'},{...policy,id:9,name:'Retired',is_active:0,assigned_active_books:0,assigned_archived_books:0}]);
  mount();await screen.findByText('Short loan');fireEvent.click(screen.getByRole('button',{name:'Sort by Loan duration'}));
  expect(screen.getAllByRole('rowheader')[0]).toHaveTextContent('Short loan');
  fireEvent.mouseDown(screen.getByRole('tab',{name:'Archived'}),{button:0,ctrlKey:false});expect(await screen.findByText('Retired')).toBeInTheDocument();expect(screen.getByRole('button',{name:'Edit Retired'})).toBeDisabled();
  fireEvent.pointerDown(screen.getByRole('button',{name:'More actions for Retired'}),{button:0,ctrlKey:false,pointerType:'mouse'});
  expect(await screen.findByRole('menuitem',{name:'Restore policy'})).toBeInTheDocument();
 });
 it('uses the Audit Log timezone for SQL and ISO instants',()=>{
  expect(adminInstant('2026-10-09 01:47:34').toISOString()).toBe('2026-10-08T17:47:34.000Z');
  expect(adminUpdatedTime('2026-10-08T17:47:34.000Z')).toBe(adminUpdatedTime('2026-10-09 01:47:34'));
 });
 it('validates monetary bounds, duplicate archived names and minute precision',()=>{
  const draft=policyDraft(policy);expect(policyErrors(draft,[policy],7)).toEqual({});
  expect(policyErrors({...draft,initial:'-1',recurring:'1.001',duration:'0'},[])).toHaveProperty('initial');
  expect(policyErrors({...draft,name:'General collection'},[{...policy,is_active:0}])).toHaveProperty('name');
  expect(policyErrors({...draft,unit:'hour',duration:'1.5'},[],7)).toEqual({});
  expect(policyErrors({...draft,unit:'hour',duration:'0.001'},[],7)).toHaveProperty('duration');
  expect(finePreview(2,0.5,'day')).toBe('Overdue by 3 days = ₱3.50 (₱2.00 initial + ₱0.50 × 3 days)');
  expect(loanDuration({...policy,loan_duration_unit:'hour',loan_duration_minutes:90})).toBe('1 h 30 min');
 });
});
