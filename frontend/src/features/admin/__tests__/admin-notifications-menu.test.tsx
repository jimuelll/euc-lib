// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {MemoryRouter,useLocation} from 'react-router-dom';
import {AdminTopbar} from '../layout/components/AdminLayoutComponents';

const state=vi.hoisted(()=>({role:'admin',notifications:[] as Array<Record<string,unknown>>,unreadCount:0,openNotification:vi.fn(),markAllAsRead:vi.fn()}));
vi.mock('@/context/AuthContext',()=>({useAuth:()=>({user:{role:state.role}})}));
vi.mock('@/context/NotificationsContext',()=>({useNotifications:()=>state}));
vi.mock('@/components/ui/sidebar',()=>({SidebarTrigger:()=> <button>Open navigation</button>}));
vi.mock('../components/AdminThemeToggle',()=>({AdminThemeToggle:()=> <button>Theme</button>}));
function Location(){return <output data-testid="location">{useLocation().pathname}</output>;}
function mount(){render(<MemoryRouter initialEntries={['/admin']}><AdminTopbar pathname="/admin"/><Location/></MemoryRouter>);}
async function open(){const trigger=screen.getByRole('button',{name:state.unreadCount?`${state.unreadCount} unread notifications`:'Notifications'});fireEvent.pointerDown(trigger,{button:0,ctrlKey:false});return screen.findByRole('menu');}
beforeEach(()=>{state.role='admin';state.unreadCount=1;state.notifications=[{id:1,title:'Reservation placed',body:'Your reservation has been placed and is pending library processing.',created_at:new Date(Date.now()-172800000).toISOString(),is_read:false},{id:2,title:'Book return recorded',body:'The return has been recorded successfully.',created_at:new Date(Date.now()-3600000).toISOString(),is_read:true}];state.openNotification.mockReset();state.markAllAsRead.mockReset().mockResolvedValue(undefined);});
afterEach(cleanup);
it('shows divided rows, relative times and unread state; selecting opens the notification',async()=>{mount();const menu=within(await open());const first=menu.getByRole('menuitem',{name:/Reservation placed/});expect(first).toHaveTextContent('2d ago');expect(first).toHaveTextContent('Unread');expect(first).toHaveClass('border-b');expect(menu.getByRole('menuitem',{name:/Book return recorded/})).not.toHaveTextContent('Unread');fireEvent.click(first);expect(state.openNotification).toHaveBeenCalledWith(1);});
it('keeps mark all read and admin management navigation',async()=>{mount();const menu=within(await open());fireEvent.click(menu.getByRole('button',{name:'Mark all read'}));expect(state.markAllAsRead).toHaveBeenCalledTimes(1);fireEvent.click(menu.getByRole('menuitem',{name:'Manage notifications'}));await waitFor(()=>expect(screen.getByTestId('location')).toHaveTextContent('/admin/notifications'));});
it('shows an empty state and hides management for staff',async()=>{state.role='staff';state.notifications=[];state.unreadCount=0;mount();const menu=within(await open());expect(menu.getByText('No notifications yet.')).toBeInTheDocument();expect(menu.queryByRole('button',{name:'Mark all read'})).toBeNull();expect(menu.queryByRole('menuitem',{name:'Manage notifications'})).toBeNull();});
it('lets keyboard users select an entry and restores focus on escape',async()=>{mount();const trigger=screen.getByRole('button',{name:'1 unread notifications'});trigger.focus();fireEvent.keyDown(trigger,{key:'ArrowDown'});const menu=within(await screen.findByRole('menu'));await waitFor(()=>expect(menu.getByRole('menuitem',{name:/Reservation placed/})).toHaveFocus());fireEvent.keyDown(menu.getByRole('menuitem',{name:/Reservation placed/}),{key:'Escape'});await waitFor(()=>expect(trigger).toHaveFocus());});
