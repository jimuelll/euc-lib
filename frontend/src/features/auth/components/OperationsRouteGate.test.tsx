// @vitest-environment jsdom
import {afterEach,expect,it,vi} from "vitest";
import {cleanup,render,screen} from "@testing-library/react";
import {MemoryRouter,useLocation,useNavigate} from "react-router-dom";
import {fireEvent} from "@testing-library/react";
import OperationsRouteGate from "./OperationsRouteGate";
const auth=vi.hoisted(()=>({user:null as null|{role:string},loading:false}));
vi.mock("@/context/AuthContext",()=>({useAuth:()=>auth}));
afterEach(()=>{cleanup();auth.user=null;auth.loading=false;});
function Page(){const location=useLocation(),navigate=useNavigate();return <><output>{location.pathname+location.search}</output><button onClick={()=>navigate('/admin')}>Other page</button><button onClick={()=>navigate(-1)}>Back</button></>;}
it.each(['scanner','opac'])('redirects %s direct URLs and navigation to the assigned page',async role=>{
 auth.user={role};const home=role==='scanner'?'/scan-qr':'/catalogue';
 render(<MemoryRouter initialEntries={['/my-library','/admin']}><OperationsRouteGate><Page/></OperationsRouteGate></MemoryRouter>);
 expect(await screen.findByText(home)).toBeTruthy();
 fireEvent.click(screen.getByText('Other page'));expect(await screen.findByText(home)).toBeTruthy();
 fireEvent.click(screen.getByText('Back'));expect(await screen.findByText(home)).toBeTruthy();
});
it('waits for session restoration before mounting a page',()=>{
 auth.loading=true;
 const view=render(<MemoryRouter initialEntries={['/my-library']}><OperationsRouteGate><Page/></OperationsRouteGate></MemoryRouter>);
 expect(screen.queryByText('Other page')).toBeNull();
 auth.loading=false;auth.user={role:'opac'};
 view.rerender(<MemoryRouter initialEntries={['/my-library']}><OperationsRouteGate><Page/></OperationsRouteGate></MemoryRouter>);
 expect(screen.getByText('/catalogue')).toBeTruthy();
});
it.each([null,{role:'student'},{role:'staff'},{role:'admin'}])('preserves navigation for other users (%j)',user=>{
 auth.user=user;
 render(<MemoryRouter initialEntries={['/about']}><OperationsRouteGate><Page/></OperationsRouteGate></MemoryRouter>);
 expect(screen.getByText('/about')).toBeTruthy();
});
