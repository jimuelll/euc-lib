// @vitest-environment jsdom
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,render,screen,waitFor} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {NotificationsProvider,useNotifications} from './NotificationsContext';
const state=vi.hoisted(()=>({role:'scanner',fetch:vi.fn(),unread:vi.fn(),socket:vi.fn(),reader:vi.fn()}));
vi.mock('@/context/AuthContext',()=>({useAuth:()=>({user:{id:1,role:state.role},loading:false,getToken:()=> 'token'})}));
vi.mock('@/features/notifications/notifications.service',()=>({fetchNotifications:state.fetch,fetchUnreadCount:state.unread,markAllNotificationsRead:vi.fn(),markNotificationRead:vi.fn()}));
vi.mock('@/features/notifications/NotificationReader',()=>({default:(props:{id:number|null})=>{state.reader(props.id);return null;}}));
function Probe(){const {loading}=useNotifications();return <output>{loading?'Loading':'Ready'}</output>;}
afterEach(()=>{cleanup();vi.unstubAllGlobals();vi.clearAllMocks();});
it.each(['scanner','opac'])('does not fetch notifications or open a WebSocket for %s',async role=>{
 state.role=role;vi.stubGlobal('WebSocket',state.socket);
 render(<MemoryRouter initialEntries={['/catalogue?notification=42']}><NotificationsProvider><Probe/></NotificationsProvider></MemoryRouter>);
 await waitFor(()=>expect(screen.getByText('Ready')).toBeTruthy());
 expect(state.fetch).not.toHaveBeenCalled();expect(state.unread).not.toHaveBeenCalled();expect(state.socket).not.toHaveBeenCalled();
 expect(state.reader).not.toHaveBeenCalledWith(42);
});
