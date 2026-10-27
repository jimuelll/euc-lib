// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {MemoryRouter} from 'react-router-dom';
import {createTestQueryClientWrapper} from '@/test-utils/query-client';
import {fetchSavedBulletinPosts,setPostSaved} from '@/features/bulletin';
import MyLibrarySavedPosts from './MyLibrarySavedPosts';
vi.mock('@/context/AuthContext',()=>({useAuth:()=>({user:{id:7}})}));
vi.mock('@/features/bulletin',()=>({fetchSavedBulletinPosts:vi.fn(),setPostSaved:vi.fn()}));
afterEach(cleanup);beforeEach(()=>vi.resetAllMocks());
const show=()=>render(<MemoryRouter><MyLibrarySavedPosts/></MemoryRouter>,{wrapper:createTestQueryClientWrapper()});
it('opens the exact saved post and removes only the personal save',async()=>{
 vi.mocked(fetchSavedBulletinPosts).mockResolvedValue({data:[{id:4,title:'New reading spaces',excerpt:'Explore the library',post_type:'announcement',created_at:'2026-10-27T00:00:00Z',saved_at:'2026-10-27T00:00:00Z',unavailable:false}],page:1,hasMore:false});vi.mocked(setPostSaved).mockResolvedValue({saved_by_me:false});show();expect(await screen.findByRole('link',{name:/New reading spaces/})).toHaveAttribute('href','/bulletin?post=4');fireEvent.click(screen.getByRole('button',{name:'Remove New reading spaces from saved posts'}));await waitFor(()=>expect(setPostSaved).toHaveBeenCalledWith(4,false));
});
it('keeps archived saves removable without exposing the old post content',async()=>{
 vi.mocked(fetchSavedBulletinPosts).mockResolvedValue({data:[{id:4,title:'',excerpt:'',post_type:'announcement',created_at:'2026-10-27T00:00:00Z',saved_at:'2026-10-27T00:00:00Z',unavailable:true}],page:1,hasMore:false});show();await screen.findByText('Post unavailable');expect(screen.queryByRole('link',{name:/Post unavailable/})).not.toBeInTheDocument();expect(screen.getByRole('button',{name:'Remove unavailable post from saved posts'})).toBeEnabled();
});
it('shows an empty state with a way back to the bulletin',async()=>{
 vi.mocked(fetchSavedBulletinPosts).mockResolvedValue({data:[],page:1,hasMore:false});show();expect(await screen.findByRole('link',{name:'Browse bulletin'})).toHaveAttribute('href','/bulletin');
});
