// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {MemoryRouter} from 'react-router-dom';
import {createTestQueryClientWrapper} from '@/test-utils/query-client';
import PostReactions from './PostReactions';
import * as api from '../api';
const state=vi.hoisted(()=>({user:{id:7} as {id:number}|null}));
vi.mock('@/context/AuthContext',()=>({useAuth:()=>state}));
vi.mock('../api',()=>({setPostHelpful:vi.fn(),setPostSaved:vi.fn(),setPostInterest:vi.fn(),fetchPostReactors:vi.fn()}));
const summary={helpful_count:1,helpful_by_me:true,saved_by_me:false,interested_count:0,interested_by_me:false,reaction_counts:{like:0,helpful:1,thanks:0,interested:0},reaction_total:1,my_reaction:'helpful' as const,likes:1,liked_by_me:true};
beforeEach(()=>{vi.resetAllMocks();state.user={id:7};});afterEach(cleanup);
const show=(props:Partial<React.ComponentProps<typeof PostReactions>>={})=>render(<MemoryRouter><PostReactions postId={4} summary={summary} {...props}/></MemoryRouter>,{wrapper:createTestQueryClientWrapper()});
it('uses one public Like signal and an independent private Save action',async()=>{
 show();expect(screen.queryByRole('button',{name:/Like |Thanks|Interested/})).not.toBeInTheDocument();vi.mocked(api.setPostSaved).mockResolvedValue({saved_by_me:true});fireEvent.click(screen.getByRole('button',{name:'Save to My Library'}));await screen.findByRole('link',{name:'View saved posts'});expect(api.setPostSaved).toHaveBeenCalledWith(4,true);expect(api.setPostHelpful).not.toHaveBeenCalled();expect(screen.getByRole('button',{name:'Liked'})).toHaveAttribute('aria-pressed','true');expect(screen.getByRole('button',{name:'View people who liked this post'})).toHaveTextContent('1 like');
});
it('removes Like without removing Save',async()=>{
 vi.mocked(api.setPostHelpful).mockResolvedValue({...summary,helpful_count:0,helpful_by_me:false,saved_by_me:true,reaction_total:0,my_reaction:null});show({summary:{...summary,saved_by_me:true}});fireEvent.click(screen.getByRole('button',{name:'Liked'}));await waitFor(()=>expect(screen.getByRole('button',{name:'Like'})).toHaveAttribute('aria-pressed','false'));expect(api.setPostHelpful).toHaveBeenCalledWith(4,false);expect(screen.getByRole('button',{name:'Saved to My Library'})).toHaveAttribute('aria-pressed','true');expect(screen.queryByText(/0 likes/)).not.toBeInTheDocument();
});
it('keeps a confirmed like when a parent briefly supplies an older post summary',async()=>{
 vi.mocked(api.setPostHelpful).mockResolvedValue({...summary,helpful_count:2,helpful_by_me:true,reaction_total:2,likes:2,liked_by_me:true});
 const view=show({summary:{...summary,helpful_count:1,helpful_by_me:false,reaction_total:1,likes:1,liked_by_me:false}});
 fireEvent.click(screen.getByRole('button',{name:'Like'}));
 await waitFor(()=>expect(screen.getByRole('button',{name:'Liked'})).toHaveAttribute('aria-pressed','true'));
 view.rerender(<MemoryRouter><PostReactions postId={4} summary={{...summary,helpful_count:1,helpful_by_me:false,reaction_total:1,likes:1,liked_by_me:false}}/></MemoryRouter>);
 expect(screen.getByRole('button',{name:'Liked'})).toHaveAttribute('aria-pressed','true');
 expect(screen.getByRole('button',{name:'View people who liked this post'})).toHaveTextContent('2 likes');
});
it('requires sign-in and preserves state after an action fails',async()=>{
 const login=vi.fn();state.user=null;const view=show({onRequireLogin:login});fireEvent.click(screen.getByRole('button',{name:'Save to My Library'}));expect(login).toHaveBeenCalled();expect(api.setPostSaved).not.toHaveBeenCalled();state.user={id:7};view.rerender(<MemoryRouter><PostReactions postId={4} summary={summary}/></MemoryRouter>);vi.mocked(api.setPostHelpful).mockRejectedValue(new Error('offline'));fireEvent.click(screen.getByRole('button',{name:'Liked'}));await screen.findByRole('alert');expect(screen.getByRole('button',{name:'Liked'})).toHaveAttribute('aria-pressed','true');
});
it('opens a single Like reader list without reaction tabs',async()=>{
 vi.mocked(api.fetchPostReactors).mockResolvedValue({data:[{id:8,name:'Myra C.',role:'student',reaction:'helpful',created_at:'2026-10-27T00:00:00Z'}],page:1,hasMore:false});show({commentCount:5});fireEvent.click(screen.getByRole('button',{name:'View people who liked this post'}));await screen.findByText('Myra C.');expect(screen.queryByRole('tablist')).not.toBeInTheDocument();expect(api.fetchPostReactors).toHaveBeenCalledWith(4,'helpful',1,expect.anything());
});
it('offers separate Interested only on event posts',async()=>{
 vi.mocked(api.setPostInterest).mockResolvedValue({...summary,interested_count:1,interested_by_me:true});show({postType:'event'});fireEvent.click(screen.getByRole('button',{name:'Interested in this event'}));await screen.findByRole('button',{name:'1 interested'});expect(api.setPostInterest).toHaveBeenCalledWith(4,true);expect(api.setPostHelpful).not.toHaveBeenCalled();expect(screen.getByRole('button',{name:'Liked'})).toHaveAttribute('aria-pressed','true');
});
it('explains the active comment total on tap',async()=>{
 show({commentCount:5});fireEvent.click(screen.getByRole('button',{name:'About comment totals'}));expect(await screen.findByRole('dialog',{name:'About comment totals'})).toHaveTextContent('Removed comments are excluded');
});

it('requires login to see liker identities while leaving the count visible',()=>{
 state.user=null;const login=vi.fn();show({onRequireLogin:login});fireEvent.click(screen.getByRole('button',{name:'View people who liked this post'}));expect(login).toHaveBeenCalledOnce();expect(api.fetchPostReactors).not.toHaveBeenCalled();
});
