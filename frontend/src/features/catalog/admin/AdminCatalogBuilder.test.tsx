// @vitest-environment jsdom
import {useState} from 'react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {Toaster,toast} from '@/components/ui/sonner';
import {MemoryRouter} from 'react-router-dom';
import {createTestQueryClientWrapper} from '@/test-utils/query-client';
import AdminCatalogBuilder from './AdminCatalogBuilder';
import * as api from './catalog.api';
import type {FormField} from './AdminCatalog.types';
import {fieldErrors,blankField,impactNotes,reorderFields} from './catalog-configuration';
vi.mock('./catalog.api',()=>({saveCatalogSchema:vi.fn(),fetchConfigurationImpact:vi.fn()}));
vi.mock('./components/CatalogVisibilitySettings',()=>({default:()=>null}));
const fields:FormField[]=[{key:'title',label:'Title',type:'text',required:true,locked:true,public:true,scope:'shared',order:0},{key:'category',label:'Category',type:'select',options:['A','B'],public:true,scope:'book',order:1},{key:'old_field',label:'Old field',type:'text',archived:true,scope:'shared',order:2}];
const usage={used:59,activeUsed:57,archivedUsed:2,bookUsed:59,thesisUsed:0,missingBooks:142,missingTheses:5,publicUsed:59,options:{A:59,B:0}};
function mount(withToasts=false){function App(){const [value,setValue]=useState(fields);return <MemoryRouter><AdminCatalogBuilder fields={value} onFieldsChange={setValue}/></MemoryRouter>;}render(<>{withToasts&&<Toaster/>}<App/></>,{wrapper:createTestQueryClientWrapper()});fireEvent.change(screen.getByRole('combobox',{name:'Field view'}),{target:{value:'global'}});}
afterEach(()=>{toast.dismiss();cleanup();});
beforeEach(()=>{window.matchMedia=vi.fn().mockImplementation(()=>({matches:false,addEventListener:vi.fn(),removeEventListener:vi.fn()}));vi.clearAllMocks();vi.mocked(api.fetchConfigurationImpact).mockResolvedValue({fields:{title:usage,category:usage,old_field:{...usage,used:0}},unheldBooks:14,generatedAt:'2026-10-09T09:00:00+08:00'});vi.mocked(api.saveCatalogSchema).mockResolvedValue();});
describe('Catalog Configuration',()=>{
 it('shows explicit counts and guards archiving with stored-value impact',async()=>{
  mount();expect(screen.getByText(/1 custom · 1 system · 1 archived/)).toBeInTheDocument();
  await waitFor(()=>expect(screen.getByRole('button',{name:/Actions for Category/})).toBeEnabled(),{timeout:5000});
  fireEvent.keyDown(screen.getByRole('button',{name:/Actions for Category/}),{key:'ArrowDown'});fireEvent.click(await screen.findByRole('menuitem',{name:/Archive field/}));
  const confirm=await screen.findByRole('alertdialog');expect(within(confirm).getByText(/59 records keep their values/)).toBeInTheDocument();expect(within(confirm).getByText(/You can restore/)).toBeInTheDocument();
  fireEvent.click(within(confirm).getByRole('button',{name:'Archive field'}));await waitFor(()=>expect(api.saveCatalogSchema).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({key:'category',archived:true})]),fields,[]));
 });
 it('requires a valid dirty edit and confirms removal of used dropdown options',async()=>{
  mount();await waitFor(()=>expect(screen.getByRole('button',{name:/Actions for Category/})).toBeEnabled());fireEvent.click(screen.getByRole('button',{name:'Edit Category'}));
  const dialog=await screen.findByRole('dialog');expect(within(dialog).getByLabelText(/Field key/)).toHaveTextContent('category');expect(within(dialog).getByRole('button',{name:'Save changes'})).toBeDisabled();
  fireEvent.click(within(dialog).getByRole('button',{name:'Remove option A'}));const removal=await screen.findByRole('alertdialog');expect(within(removal).getByText(/59 records/)).toBeInTheDocument();fireEvent.click(within(removal).getByRole('button',{name:'Remove option'}));await waitFor(()=>expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());expect(within(dialog).getByRole('heading',{name:'Impact of your changes'})).toBeInTheDocument();fireEvent.click(within(dialog).getByRole('button',{name:'Save changes'}));
  const confirm=await screen.findByRole('alertdialog');expect(within(confirm).getByText(/A \(59 records\)/)).toBeInTheDocument();expect(api.saveCatalogSchema).not.toHaveBeenCalled();
 });
 it('supports global keyboard reordering and disables it when filtered',async()=>{
  mount();const handle=await screen.findByRole('button',{name:'Reorder Category'});await waitFor(()=>expect(handle).toBeEnabled());fireEvent.keyDown(handle,{key:'ArrowUp'});
  await waitFor(()=>expect(api.saveCatalogSchema).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({key:'category',order:0})]),fields,[]));
  fireEvent.change(screen.getByRole('textbox',{name:'Search field labels or keys'}),{target:{value:'category'}});expect(screen.getByRole('button',{name:'Reorder Category'})).toBeDisabled();
 });
 it('combines chips with AND and links exact usage filters',async()=>{
  mount();await waitFor(()=>expect(screen.getByRole('button',{name:/Actions for Category/})).toBeEnabled());
  expect(screen.getAllByRole('link',{name:'59 records →'})[1]).toHaveAttribute('href',expect.stringContaining('fieldKey=category&fieldUsage=used'));
  fireEvent.click(screen.getByRole('button',{name:'Filters'}));fireEvent.click(screen.getByRole('button',{name:'System 1'}));fireEvent.click(screen.getByRole('button',{name:'Custom 1'}));expect(screen.getByText(/0 of 2 fields/)).toBeInTheDocument();
  fireEvent.click(screen.getAllByRole('button',{name:/Clear filters/})[0]);expect(screen.getByText(/2 fields/)).toBeInTheDocument();
 });
 it('explains immutable identity rules and guards closing dirty edits',async()=>{
  mount();await waitFor(()=>expect(screen.getByRole('button',{name:/Actions for Title/})).toBeEnabled());fireEvent.click(screen.getByRole('button',{name:'Edit Title'}));
  const dialog=await screen.findByRole('dialog');expect(within(dialog).getByText(/Title is always required/)).toBeInTheDocument();expect(within(dialog).getByText(/Title is always public/)).toBeInTheDocument();expect(within(dialog).getByText('No unsaved changes')).toBeInTheDocument();
  fireEvent.change(within(dialog).getByLabelText('Field label *'),{target:{value:'Record title'}});expect(within(dialog).getByText('Unsaved changes')).toBeInTheDocument();fireEvent.click(within(dialog).getByRole('button',{name:'Cancel'}));expect(await screen.findByRole('alertdialog')).toBeInTheDocument();
 });
 it('shows labelled samples, a real usage link and readonly metadata',async()=>{
  mount();fireEvent.click(await screen.findByRole('button',{name:'Edit Category'}));const dialog=await screen.findByRole('dialog');
  expect(within(dialog).getByLabelText(/Field key/)).toHaveTextContent('category');expect(within(dialog).getByLabelText(/Field key/).tagName).toBe('DIV');
  expect(within(dialog).getByText('Sample value · preview only')).toBeInTheDocument();expect(within(dialog).getByRole('link',{name:'View 59 records'})).toHaveAttribute('href',expect.stringContaining('fieldKey=category'));expect(within(dialog).getByText('57 active, 2 archived')).toBeInTheDocument();
  expect(within(dialog).getByRole('navigation',{name:'Field sections'})).toBeInTheDocument();expect(within(dialog).getByRole('navigation',{name:'Field sections'}).querySelectorAll('[aria-current=location]')).toHaveLength(1);
 });
 it('uses named visibility switches and an unused filter',async()=>{
  vi.mocked(api.fetchConfigurationImpact).mockResolvedValue({fields:{title:usage,category:{...usage,used:0},old_field:{...usage,used:0}},unheldBooks:14,generatedAt:'2026-10-10T09:00:00+08:00'});
  mount();expect(await screen.findByText('Always public')).toBeInTheDocument();expect(screen.queryByRole('switch',{name:/Public visibility for Title/})).not.toBeInTheDocument();expect(screen.getByRole('switch',{name:'Public visibility for Category'})).toBeEnabled();
  fireEvent.click(screen.getByRole('button',{name:'Filters'}));fireEvent.click(screen.getByRole('button',{name:'Unused 1'}));expect(screen.getByText(/1 of 2 fields/)).toBeInTheDocument();expect(screen.getByRole('button',{name:'Remove unused filter'})).toBeInTheDocument();
 });
 it('validates keys/options and counts impact in the desired scope',()=>{
  expect(fieldErrors({...blankField(),label:'Title'},fields,true)).toHaveProperty('key');
  expect(fieldErrors({...blankField(),label:'New dropdown',type:'select',options:['A','a']},fields,true)).toHaveProperty('options');
  expect(impactNotes(fields[1],{...fields[1],required:true,scope:'shared'},usage).join(' ')).toContain('147 records (active)');
  expect(reorderFields(fields,'category','title').find(f=>f.key==='category')?.order).toBe(0);
 });
});

it('drag saves and Undo restores order without crashing the app when notifications are outside the router',async()=>{
 mount(true);const handle=await screen.findByRole('button',{name:'Reorder Category'});await waitFor(()=>expect(handle).toBeEnabled());fireEvent.dragStart(handle);fireEvent.drop(screen.getByRole('button',{name:'Edit Title'}).closest('li')!);fireEvent.dragEnd(handle);
 await screen.findByText('Order saved');expect(screen.getByRole('button',{name:'Edit Category'})).toBeInTheDocument();expect(screen.getByRole('link',{name:'View audit records'})).toHaveAttribute('href',expect.stringContaining('/admin/audit-logs'));
 expect(screen.getByRole('button',{name:'Reorder Category'}).closest('li')?.querySelector('[aria-label="Global position 1"]')).toBeInTheDocument();fireEvent.click(screen.getByRole('button',{name:'Undo'}));await screen.findByText('Change undone');expect(api.saveCatalogSchema).toHaveBeenLastCalledWith(fields,expect.arrayContaining([expect.objectContaining({key:'category',order:0})]),[]);
});
it('confirms publishing existing values before saving and keeps scope-only requirements explicit',async()=>{
 const schema=[...fields.map(f=>f.key==='category'?{...f,public:false}:f),{key:'academic_year',label:'Academic Year',type:'text' as const,required:true,locked:true,public:true,scope:'thesis' as const,order:3}];
 vi.mocked(api.fetchConfigurationImpact).mockResolvedValue({fields:{title:usage,category:usage,old_field:usage,academic_year:{...usage,used:0}},unheldBooks:14,generatedAt:'2026-10-10T09:00:00Z'});
 function App(){const [value,setValue]=useState(schema);return <MemoryRouter><AdminCatalogBuilder fields={value} onFieldsChange={setValue}/></MemoryRouter>;}render(<App/>,{wrapper:createTestQueryClientWrapper()});fireEvent.change(screen.getByRole('combobox',{name:'Field view'}),{target:{value:'global'}});
 await waitFor(()=>expect(screen.getByRole('switch',{name:'Public visibility for Category'})).toBeEnabled());fireEvent.click(screen.getByRole('switch',{name:'Public visibility for Category'}));const dialog=await screen.findByRole('alertdialog');expect(within(dialog).getByText(/Values from 59 records/)).toBeInTheDocument();expect(api.saveCatalogSchema).not.toHaveBeenCalled();fireEvent.click(within(dialog).getByRole('button',{name:'Publish field'}));await waitFor(()=>expect(api.saveCatalogSchema).toHaveBeenCalled());
 const row=screen.getByRole('button',{name:'Edit Academic Year'}).closest('li')!;expect(within(row).getByRole('img',{name:'Theses only'})).toBeInTheDocument();expect(within(row).getByText('Required')).toHaveAttribute('title','Required for Theses only');
});
it('hides position numbers and blocks drag when a filter is active',async()=>{
 mount();await waitFor(()=>expect(screen.getByRole('button',{name:'Reorder Category'})).toBeEnabled());fireEvent.change(screen.getByRole('textbox',{name:'Search field labels or keys'}),{target:{value:'category'}});expect(screen.getByRole('button',{name:'Reorder Category'})).toBeDisabled();expect(document.querySelector('[aria-label^="Global position"]')).toBeNull();
});

it('groups by origin while retaining unused grouping and global drag editing',async()=>{
 vi.mocked(api.fetchConfigurationImpact).mockResolvedValue({fields:{title:usage,category:{...usage,used:0},old_field:{...usage,used:0}},unheldBooks:0,generatedAt:'2026-10-10T09:00:00Z'});
 render(<MemoryRouter><AdminCatalogBuilder fields={fields} onFieldsChange={vi.fn()}/></MemoryRouter>,{wrapper:createTestQueryClientWrapper()});await screen.findByText('System fields · 1');expect(screen.getByText('Custom fields · 1')).toBeInTheDocument();expect(screen.getByRole('img',{name:'Books only'})).toBeInTheDocument();fireEvent.change(screen.getByRole('combobox',{name:'Field view'}),{target:{value:'unused'}});await screen.findByText('Unused · 1');expect(document.querySelector('.config-unused-group')).not.toHaveAttribute('open');expect(screen.getByRole('button',{name:'Edit Category'}).closest('details')).not.toHaveAttribute('open');expect(screen.getByRole('button',{name:'Reorder Title'})).toBeDisabled();
 fireEvent.change(screen.getByRole('combobox',{name:'Field view'}),{target:{value:'global'}});expect(screen.getByRole('button',{name:'Edit Category'})).toBeInTheDocument();expect(screen.getByRole('button',{name:'Reorder Category'})).toBeEnabled();expect(api.saveCatalogSchema).not.toHaveBeenCalled();
});
