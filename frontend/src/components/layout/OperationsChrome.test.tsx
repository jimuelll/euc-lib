// @vitest-environment jsdom
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';
const state=vi.hoisted(()=>({role:'scanner',logout:vi.fn(),siteContent:vi.fn(),toggleTheme:vi.fn()}));
vi.mock('@/context/AuthContext',()=>({useAuth:()=>({user:{id:1,name:'Library terminal',role:state.role},loading:false,logout:state.logout})}));
vi.mock('@/context/NotificationsContext',()=>({useNotifications:()=>({notifications:[],unreadCount:0,openNotification:vi.fn(),markAllAsRead:vi.fn()})}));
vi.mock('@/hooks/use-theme',()=>({useTheme:()=>({theme:'dark',toggleTheme:state.toggleTheme})}));
vi.mock('@/features/site-content',()=>({useSiteContent:state.siteContent}));
afterEach(()=>{cleanup();vi.clearAllMocks();});
it.each(['scanner','opac'])('renders the shared station header with only its account menu for %s',async role=>{
 state.role=role;render(<MemoryRouter><Navbar/><Footer/></MemoryRouter>);
 const home=role==='scanner'?'/scan-qr':'/catalogue';
 const links=screen.getAllByRole('link');expect(links).toHaveLength(1);
 for(const link of links)expect(link.getAttribute('href')).toBe(home);
 expect(screen.queryByLabelText('Open notifications')).toBeNull();
 expect(screen.queryByText('My Library')).toBeNull();expect(state.siteContent).not.toHaveBeenCalled();
 expect(screen.queryByRole('navigation')).toBeNull();
 expect(screen.getByLabelText(role==='scanner'?'Scanner station':'Catalogue station')).toBeTruthy();
 fireEvent.click(screen.getByRole('button',{name:'Toggle theme'}));expect(state.toggleTheme).toHaveBeenCalledOnce();
 expect(screen.queryByRole('menuitem',{name:'Sign out'})).toBeNull();
 fireEvent.keyDown(screen.getByRole('button',{name:'Account menu: Library terminal'}),{key:'Enter'});
 fireEvent.click(await screen.findByRole('menuitem',{name:'Sign out'}));expect(state.logout).toHaveBeenCalledOnce();
});
