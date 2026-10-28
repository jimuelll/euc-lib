// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, configure, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MemoryRouter, useLocation } from "react-router-dom";
import { createTestQueryClient, createTestQueryClientWrapper } from "@/test-utils/query-client";
import AdminManage from "./Index";
import { useAdminManage } from "./useAdminManage";
import * as api from "./api";
configure({asyncUtilTimeout:10000});
vi.setConfig({testTimeout:20000});
Object.defineProperties(HTMLElement.prototype, {
 hasPointerCapture:{configurable:true,value:()=>false},
 setPointerCapture:{configurable:true,value:()=>{}},
 releasePointerCapture:{configurable:true,value:()=>{}},
 scrollIntoView:{configurable:true,value:()=>{}},
});
const signedIn=vi.hoisted(()=>({role:"super_admin"}));
vi.mock("@/context/AuthContext",()=>({useAuth:()=>({user:{id:42,role:signedIn.role}})}));
vi.mock("./api",()=>({searchUsers:vi.fn(),fetchAcademicPrograms:vi.fn(),fetchAcademicTerms:vi.fn(),fetchDepartments:vi.fn(),createUser:vi.fn(),updateUser:vi.fn(),archiveUser:vi.fn(),restoreUser:vi.fn(),requestAccountEmail:vi.fn(),checkUserAvailability:vi.fn(),fetchAccountEmailStatus:vi.fn(),resetOperationsPassword:vi.fn()}));
const patron = {name:"Alex Rivera",student_employee_id:"CARD-1",library_card_number:"CARD-1",student_number:"ST-1",role:"student",program_id:1,academic_term_id:1,year_level:"2nd Year",is_active:1,active_loans:2,overdue_loans:1,unpaid_fines:1260,active_reservations:1};
const admin = {name:"Desk Admin",student_employee_id:"admin-one",username:"admin-one",role:"admin",email:"desk@example.edu",email_verified_at:"2026-10-01",is_active:1,active_loans:0,overdue_loans:0,unpaid_fines:0,active_reservations:0};
function Location(){return <output data-testid="route">{useLocation().search}</output>;}
function mount(url="/admin/manage"){const Wrapper=createTestQueryClientWrapper(createTestQueryClient());render(<Wrapper><MemoryRouter initialEntries={[url]}><AdminManage/><Location/></MemoryRouter></Wrapper>);}
beforeEach(()=>{signedIn.role="super_admin";vi.resetAllMocks();vi.mocked(api.checkUserAvailability).mockResolvedValue({available:true});vi.mocked(api.fetchAccountEmailStatus).mockResolvedValue({deliveries:[]});vi.mocked(api.searchUsers).mockResolvedValue({rows:[patron,admin],summary:{total:3,active:2,needsAttention:1,statuses:{active:2,inactive:0,archived:1,all:3},roles:{student:2,admin:1}},pagination:{page:1,limit:25,total:2,totalPages:1}});vi.mocked(api.fetchAcademicPrograms).mockResolvedValue([{id:1,name:"Information Systems"}]);vi.mocked(api.fetchAcademicTerms).mockResolvedValue([{id:1,name:"2026-2027",starts_on:"2026-08-01",ends_on:"2027-06-01",is_current:1}]);vi.mocked(api.fetchDepartments).mockResolvedValue([]);vi.mocked(api.updateUser).mockResolvedValue({message:"Saved"});});
afterEach(cleanup);
it("uses counted filters, live search and a clearance deep link",async()=>{mount();await screen.findByRole("button",{name:"All 3"});expect(screen.getByRole("link",{name:/Needs attention/}).getAttribute("href")).toContain("/admin/clearance?tab=queue");expect(screen.queryByRole("button",{name:"Total patrons"})).toBeNull();expect(screen.getByText("3 patrons")).toBeTruthy();expect(screen.queryByRole("button",{name:"Search"})).toBeNull();fireEvent.click(screen.getByRole("button",{name:"Archived 1"}));await waitFor(()=>expect(screen.getByTestId("route").textContent).toContain("filter=archived"));fireEvent.change(screen.getByRole("textbox",{name:"Search users"}),{target:{value:"Alex"}});await waitFor(()=>expect(api.searchUsers).toHaveBeenLastCalledWith(expect.objectContaining({query:"Alex",status:"archived"}),expect.any(AbortSignal)));},15000);
it("sections the patron form, hides passwords and blocks unsafe archival",async()=>{mount();fireEvent.click(await screen.findByRole("button",{name:"Alex Rivera"}));const drawer=within(screen.getByRole("dialog"));expect(drawer.getByRole("region",{name:"Academic"})).toBeTruthy();expect(drawer.queryByLabelText("New password")).toBeNull();fireEvent.mouseDown(drawer.getByRole("tab",{name:"Access"}),{button:0,ctrlKey:false});expect(drawer.getByRole("button",{name:"Archive user"}).hasAttribute("disabled")).toBe(true);fireEvent.mouseDown(drawer.getByRole("tab",{name:"Borrowing"}),{button:0,ctrlKey:false});expect(drawer.getByRole("region",{name:"Borrowing summary"}).textContent).toContain("1,260.00");expect(drawer.getByRole("button",{name:"Save changes"}).hasAttribute("disabled")).toBe(true);});
it("keeps student-only fields out of an administrator record",async()=>{mount();fireEvent.click(await screen.findByRole("button",{name:"Desk Admin"}));const drawer=within(screen.getByRole("dialog"));expect(drawer.queryByRole("region",{name:"Academic"})).toBeNull();expect(drawer.queryByLabelText("Student number")).toBeNull();expect(drawer.getByLabelText("Username")).toBeTruthy();});
it("prompts before discarding changes and preserves the draft on cancel",async()=>{mount();fireEvent.click(await screen.findByRole("button",{name:"Alex Rivera"}));fireEvent.change(screen.getByLabelText("Full name"),{target:{value:"Alex Updated"}});expect(screen.getByText("1 unsaved change")).toBeTruthy();fireEvent.click(screen.getByRole("button",{name:"Close"}));await screen.findByRole("alertdialog");fireEvent.click(screen.getByRole("button",{name:"Keep editing"}));expect((screen.getByLabelText("Full name") as HTMLInputElement).value).toBe("Alex Updated");expect(api.updateUser).not.toHaveBeenCalled();});
it("requests a recovery email without accepting staff passwords",async()=>{vi.mocked(api.requestAccountEmail).mockResolvedValue({message:"Account email queued if eligible."});mount();fireEvent.click(await screen.findByRole("button",{name:"Desk Admin"}));expect(screen.queryByLabelText("New password")).toBeNull();fireEvent.mouseDown(screen.getByRole("tab",{name:"Access"}),{button:0,ctrlKey:false});fireEvent.click(screen.getByRole("button",{name:"Send recovery email"}));await waitFor(()=>expect(api.requestAccountEmail).toHaveBeenCalledWith("admin-one","recovery"));expect(api.updateUser).not.toHaveBeenCalled();});
it("shows unavailable totals and retry on initial failure",async()=>{vi.mocked(api.searchUsers).mockRejectedValue(new Error("Offline"));mount();await screen.findByRole("alert");expect(screen.queryByRole("button",{name:"All 0"})).toBeNull();expect(screen.getByRole("button",{name:"Retry"})).toBeTruthy();});

function RoleChangeHarness(){const state=useAdminManage();return <>{state.confirmDialog}<button onClick={()=>{state.selectUserForEdit(admin);state.setField("role","staff");}}>Stage role</button><button onClick={()=>void state.handleUpdateUser()}>Save role</button></>;}
it("requires explicit confirmation before a permitted role change reaches the API",async()=>{const Wrapper=createTestQueryClientWrapper(createTestQueryClient());render(<Wrapper><MemoryRouter><RoleChangeHarness/></MemoryRouter></Wrapper>);fireEvent.click(screen.getByRole("button",{name:"Stage role"}));fireEvent.click(screen.getByRole("button",{name:"Save role"}));await screen.findByRole("alertdialog");expect(api.updateUser).not.toHaveBeenCalled();fireEvent.click(screen.getByRole("button",{name:"Confirm role change"}));await waitFor(()=>expect(api.updateUser).toHaveBeenCalledWith("admin-one",expect.objectContaining({role:"staff"})));});

it("opens a patron drawer from an attendance handoff",async()=>{mount("/admin/manage?q=CARD-1&status=all&patron=CARD-1");await screen.findByRole("dialog");expect(screen.getByRole("dialog").textContent).toContain("Alex Rivera");});

it.each(['programId','departmentId','termId'])('keeps the %s academic reference filter in the Users request',async key=>{mount('/admin/manage?'+key+'=7&status=all&academicLabel=Academic%20entry');await screen.findByText('Users linked to Academic entry');await waitFor(()=>expect(api.searchUsers).toHaveBeenCalledWith(expect.objectContaining({[key]:'7',status:'all'}),expect.any(AbortSignal)));});

it.each(["admin","staff","scanner","student","employee","alumni"])("hides account emails from %s",async role=>{
 signedIn.role=role;mount();await screen.findByRole("textbox",{name:"Search users"});
 expect(screen.queryByRole("link",{name:"Account emails"})).toBeNull();
});
it("shows account emails for super admins",async()=>{
 mount();expect((await screen.findByRole("link",{name:"Account emails"})).getAttribute("href")).toBe("/admin/account-emails");
});

const ownSuperAdmin={...admin,user_id:42,name:"My Super Admin",student_employee_id:"super-one",username:"super-one",role:"super_admin"};
it("allows super admins to save their own details while preserving their role and archive protection",async()=>{
 vi.mocked(api.searchUsers).mockResolvedValue({rows:[ownSuperAdmin],summary:undefined,pagination:{page:1,limit:25,total:1,totalPages:1}});
 mount();fireEvent.click(await screen.findByRole("button",{name:"My Super Admin"}));
 fireEvent.mouseDown(screen.getByRole("tab",{name:"Access"}),{button:0,ctrlKey:false});expect(screen.getByRole("combobox",{name:"Role"}).hasAttribute("disabled")).toBe(true);
 expect(screen.queryByRole("button",{name:"Archive user"})).toBeNull();
 fireEvent.mouseDown(screen.getByRole("tab",{name:"Profile"}),{button:0,ctrlKey:false});
 fireEvent.change(screen.getByLabelText("Full name"),{target:{value:"Updated Super Admin"}});
 await waitFor(()=>expect(screen.getByRole("button",{name:"Save changes"}).hasAttribute("disabled")).toBe(false));
 fireEvent.click(screen.getByRole("button",{name:"Save changes"}));
 await waitFor(()=>expect(api.updateUser).toHaveBeenCalledWith("super-one",expect.objectContaining({fullName:"Updated Super Admin",role:"super_admin"})));
});
it("keeps another super admin record read-only",async()=>{
 vi.mocked(api.searchUsers).mockResolvedValue({rows:[{...ownSuperAdmin,user_id:99}],summary:undefined,pagination:{page:1,limit:25,total:1,totalPages:1}});
 mount();fireEvent.click(await screen.findByRole("button",{name:"My Super Admin"}));
 expect(screen.getByLabelText("Full name").hasAttribute("disabled")).toBe(true);
 expect(screen.queryByRole("button",{name:"Save changes"})).toBeNull();
});
function RolesHarness(){const state=useAdminManage();return <output data-testid="allowed-roles">{state.allowedRoles.join(",")}</output>;}
it.each(["super_admin","admin","staff"])("only super admins can select the super admin role for creation (%s)",role=>{
 signedIn.role=role;const Wrapper=createTestQueryClientWrapper(createTestQueryClient());
 render(<Wrapper><MemoryRouter><RolesHarness/></MemoryRouter></Wrapper>);
 expect(screen.getByTestId("allowed-roles").textContent?.split(",").includes("super_admin")).toBe(role==="super_admin");
});

it('starts with only roles, then shows the selected role fields and current term',async()=>{
 mount();fireEvent.click(await screen.findByRole('button',{name:'Create user'}));
 expect(screen.queryByLabelText('Full name')).toBeNull();expect(screen.getByText('1 required field left')).toBeTruthy();
 expect(screen.getByRole('group',{name:'Choose a role'})).toBeInTheDocument();
 expect(screen.queryByRole('combobox',{name:'Role'})).toBeNull();
 await choose('Role','Student');
 expect(screen.getByLabelText('Student number')).toBeTruthy();
 expect(screen.getByRole('combobox',{name:'Academic term'}).textContent).toContain('2026-2027');
 fireEvent.change(screen.getByLabelText('Full name'),{target:{value:'New Desk'}});
 await choose('Role','Staff');
 expect(screen.queryByLabelText('Student number')).toBeNull();expect(screen.getByLabelText('Username')).toBeTruthy();
 expect((screen.getByLabelText('Full name') as HTMLInputElement).value).toBe('New Desk');
 expect(screen.getByRole('button',{name:'Create and send invitation'}).hasAttribute('disabled')).toBe(true);
});
it('shows errors after blur and blocks duplicate email until corrected',async()=>{
 vi.mocked(api.checkUserAvailability).mockImplementation(async(field,value)=>({available:field!=='email'||value!=='used@example.edu'}));
 mount();fireEvent.click(await screen.findByRole('button',{name:'Create user'}));await choose('Role','Staff');
 expect(screen.queryByText('This field is required.')).toBeNull();
 fireEvent.blur(screen.getByLabelText('Full name'));expect(screen.getByText('This field is required.')).toBeTruthy();
 fireEvent.change(screen.getByLabelText('Full name'),{target:{value:'New Desk'}});fireEvent.change(screen.getByLabelText('Username'),{target:{value:'new.desk'}});
 fireEvent.change(screen.getByLabelText('Email'),{target:{value:'used@example.edu'}});fireEvent.blur(screen.getByLabelText('Email'));
 await screen.findByText('This email already belongs to another user.');
 expect(screen.getByRole('button',{name:'Create and send invitation'}).hasAttribute('disabled')).toBe(true);
 fireEvent.change(screen.getByLabelText('Email'),{target:{value:'new@example.edu'}});
 await waitFor(()=>expect(screen.getByRole('button',{name:'Create and send invitation'}).hasAttribute('disabled')).toBe(false));
});
it('keeps edits between tabs, disables email actions while dirty and discards to baseline',async()=>{
 mount();fireEvent.click(await screen.findByRole('button',{name:'Desk Admin'}));
 fireEvent.change(screen.getByLabelText('Full name'),{target:{value:'Changed Desk'}});
 fireEvent.mouseDown(screen.getByRole('tab',{name:'Access'}),{button:0,ctrlKey:false});
 expect(screen.getByRole('button',{name:'Send recovery email'}).hasAttribute('disabled')).toBe(true);
 expect(screen.getByRole('button',{name:'Send verification email'}).hasAttribute('disabled')).toBe(true);
 expect(screen.queryByRole('tab',{name:'Borrowing'})).toBeNull();
 fireEvent.mouseDown(screen.getByRole('tab',{name:'Profile'}),{button:0,ctrlKey:false});
 expect((screen.getByLabelText('Full name') as HTMLInputElement).value).toBe('Changed Desk');
 fireEvent.click(screen.getByRole('button',{name:'Discard'}));expect((screen.getByLabelText('Full name') as HTMLInputElement).value).toBe('Desk Admin');
 expect(screen.getByText('No unsaved changes')).toBeTruthy();
});

async function choose(label:string,option:string) {
 if(label==='Role'){fireEvent.click(screen.getByRole('radio',{name:option}));return;}
 fireEvent.keyDown(screen.getByRole('combobox',{name:label}),{key:'ArrowDown'});
 fireEvent.click(await screen.findByRole('option',{name:option}));
}
it.each(['Scanner','OPAC'])('creates a dedicated %s account without email',async type=>{
 vi.mocked(api.createUser).mockResolvedValue({message:'Created'});
 mount();fireEvent.click(await screen.findByRole('button',{name:'Create user'}));
 await choose('Role','Library Operations');
 expect(screen.queryByLabelText('Full name')).toBeNull();
 await choose('Operations type',type);
 expect(screen.queryByLabelText('Email')).toBeNull();
 expect(screen.queryByText(/invitation will be sent/i)).toBeNull();
 fireEvent.change(screen.getByLabelText('Full name'),{target:{value:'Library terminal'}});
 fireEvent.change(screen.getByLabelText('Username'),{target:{value:'terminal'}});
 fireEvent.change(screen.getByLabelText('Password'),{target:{value:'terminal-password'}});
 fireEvent.change(screen.getByLabelText('Confirm password'),{target:{value:'terminal-password'}});
 await waitFor(()=>expect(screen.getByRole('button',{name:'Create account'})).not.toBeDisabled());
 fireEvent.click(screen.getByRole('button',{name:'Create account'}));
 await waitFor(()=>expect(api.createUser).toHaveBeenCalledWith(expect.objectContaining({role:type==='OPAC'?'opac':'scanner',email:'',password:'terminal-password'})));
 expect(api.requestAccountEmail).not.toHaveBeenCalled();
 expect(api.checkUserAvailability).not.toHaveBeenCalledWith('email',expect.anything(),expect.anything(),expect.anything());
});
it('does not offer Library Operations creation to Staff',async()=>{
 signedIn.role='staff';mount();fireEvent.click(await screen.findByRole('button',{name:'Create user'}));
 expect(screen.queryByRole('radio',{name:'Library Operations'})).toBeNull();
});
it('keeps operations editing separate and offers an admin password reset',async()=>{
 vi.mocked(api.searchUsers).mockResolvedValue({rows:[{...admin,role:'scanner'}],summary:undefined,pagination:{page:1,limit:25,total:1,totalPages:1}});
 vi.mocked(api.resetOperationsPassword).mockResolvedValue({message:'Password reset'});
 mount();fireEvent.click(await screen.findByRole('button',{name:'Desk Admin'}));
 expect(screen.queryByLabelText('Email')).toBeNull();
 fireEvent.mouseDown(screen.getByRole('tab',{name:'Access'}),{button:0,ctrlKey:false});
 expect(screen.queryByRole('button',{name:'Send recovery email'})).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'Reset password'}));
 fireEvent.change(screen.getByLabelText('New password'),{target:{value:'replacement-password'}});
 fireEvent.change(screen.getByLabelText('Confirm new password'),{target:{value:'replacement-password'}});
 fireEvent.click(screen.getByRole('button',{name:'Save new password'}));
 await waitFor(()=>expect(api.resetOperationsPassword).toHaveBeenCalledWith('admin-one','replacement-password'));
 fireEvent.keyDown(screen.getByRole('combobox',{name:'Operations type'}),{key:'ArrowDown'});
 expect(screen.queryByRole('option',{name:'Student'})).toBeNull();
 expect(screen.getByRole('option',{name:'OPAC'})).toBeInTheDocument();
});

it('shows OPAC accounts in the user table and exposes the OPAC role filter',async()=>{
 const opac={...admin,name:'Development OPAC',student_employee_id:'devopac',username:'devopac',role:'opac',email:null};
 vi.mocked(api.searchUsers).mockResolvedValue({rows:[opac],summary:{total:1,active:1,needsAttention:0,statuses:{active:1,inactive:0,archived:0,all:1},roles:{opac:1}},pagination:{page:1,limit:25,total:1,totalPages:1}});
 mount();expect(await screen.findByRole('button',{name:'Development OPAC'})).toBeInTheDocument();
 expect(screen.getByText('OPAC',{selector:'.users-role'})).toBeInTheDocument();
 fireEvent.keyDown(screen.getByRole('combobox',{name:'Role'}),{key:'ArrowDown'});
 fireEvent.click(await screen.findByRole('option',{name:'OPAC (1)'}));
 await waitFor(()=>expect(api.searchUsers).toHaveBeenLastCalledWith(expect.objectContaining({role:'opac'}),expect.any(AbortSignal)));
});
