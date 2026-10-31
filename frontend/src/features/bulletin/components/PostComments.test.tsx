// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {createTestQueryClientWrapper} from '@/test-utils/query-client';
import PostComments from './PostComments';
import * as api from '../api';
vi.mock('@/context/AuthContext',()=>({useAuth:()=>({user:{id:7,role:'student'}})}));
vi.mock('@/features/admin/public',()=>({useAdminConfirmDialog:()=>({confirm:async()=>true,confirmDialog:null})}));
vi.mock('../api',()=>({fetchPostComments:vi.fn(),createBulletinComment:vi.fn(),deleteBulletinComment:vi.fn(),reportBulletinComment:vi.fn(),setCommentHelpful:vi.fn(),moderateComment:vi.fn(),fetchCommentContext:vi.fn(),fetchDiscussionUpdates:vi.fn(),fetchCommentSnapshots:vi.fn(),fetchCommentLikers:vi.fn(),fetchMyCommentReviews:vi.fn(),requestCommentReview:vi.fn()}));
const row=(id:number,parent_id:number|null,author:string,reply_count=0)=>({id,parent_id,author,author_id:id,text:`Message ${id}`,created_at:'2026-10-27T00:00:00Z',reply_count});
beforeEach(()=>{localStorage.clear();vi.resetAllMocks();vi.mocked(api.fetchCommentSnapshots).mockResolvedValue([]);vi.mocked(api.fetchMyCommentReviews).mockResolvedValue({data:[],page:1,hasMore:false});vi.mocked(api.fetchPostComments).mockImplementation(async(_id,parent)=>({data:[parent===null?row(1,null,'Reader',1):parent===1?row(2,1,'Librarian',1):row(3,2,'Student')],page:1,hasMore:false}));});afterEach(cleanup);
it('keeps a failed reply, submits its parent, and opens a focused nested thread',async()=>{
 render(<PostComments postId={4} onChanged={()=>{}}/>,{wrapper:createTestQueryClientWrapper()});await screen.findByText('Message 1');
 fireEvent.click(screen.getByRole('button',{name:'Reply'}));expect(screen.getByText(/Replying to/)).toHaveTextContent('Reader');
 fireEvent.change(screen.getByRole('textbox',{name:'Write a reply'}),{target:{value:'A reply'}});vi.mocked(api.createBulletinComment).mockRejectedValueOnce(new Error('offline'));
 fireEvent.click(screen.getByRole('button',{name:'Post reply'}));await screen.findByRole('alert');expect(screen.getByRole('textbox')).toHaveValue('A reply');
 expect(api.createBulletinComment).toHaveBeenCalledWith(4,'A reply',1,expect.any(String));
 vi.mocked(api.createBulletinComment).mockResolvedValue(row(4,1,'Me'));fireEvent.click(screen.getByRole('button',{name:'Post reply'}));await waitFor(()=>expect(screen.getByRole('textbox')).toHaveValue(''));
 await screen.findByText('Message 2');fireEvent.click(screen.getByRole('button',{name:'Continue thread (1)'}));await screen.findByRole('heading',{name:'Thread'});await screen.findByText('Message 3');
 fireEvent.click(screen.getByRole('button',{name:'All comments'}));expect(screen.getByRole('heading',{name:'Discussion'})).toBeInTheDocument();
},15000);
it('renders removed parents without their original text and still offers their replies',async()=>{
 vi.mocked(api.fetchPostComments).mockResolvedValue({data:[{...row(1,null,'',1),text:'',deleted_at:'2026-10-27T01:00:00Z'}],hasMore:false,page:1});
 render(<PostComments postId={4} onChanged={()=>{}}/>,{wrapper:createTestQueryClientWrapper()});await screen.findByText('Comment removed');expect(screen.queryByRole('button',{name:'Reply'})).not.toBeInTheDocument();expect(screen.getByRole('button',{name:'1 reply'})).toBeInTheDocument();
});

it('collapses the idle composer and names and focuses a reply target',async()=>{
 render(<PostComments postId={4} onChanged={()=>{}}/>,{wrapper:createTestQueryClientWrapper()});await screen.findByText('Message 1');
 const input=screen.getByRole('textbox');expect(input).toHaveAttribute('rows','1');expect(screen.queryByText(/Keep discussion respectful/)).not.toBeInTheDocument();expect(screen.getByRole('button',{name:'Post comment'})).toBeDisabled();
 fireEvent.focus(input);expect(input).toHaveAttribute('rows','3');expect(screen.getByText(/Keep discussion respectful/)).toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'Reply'}));expect(input).toHaveFocus();expect(screen.getByText(/Replying to/)).toHaveTextContent('Reader');fireEvent.click(screen.getByRole('button',{name:'Cancel reply'}));expect(screen.queryByText(/Replying to/)).not.toBeInTheDocument();
});
it('announces a submitted comment and keeps it visible beyond the loaded page',async()=>{
 vi.mocked(api.createBulletinComment).mockResolvedValue(row(99,null,'Me'));
 render(<PostComments postId={4} onChanged={()=>{}}/>,{wrapper:createTestQueryClientWrapper()});await screen.findByText('Message 1');fireEvent.change(screen.getByRole('textbox'),{target:{value:'New comment'}});fireEvent.click(screen.getByRole('button',{name:'Post comment'}));
 await screen.findByText('Message 99');expect(screen.getByRole('status')).toHaveTextContent('Comment posted.');expect(screen.getByRole('textbox')).toHaveValue('');
});

it('keeps destructive actions in the options menu and reports other comments',async()=>{
 vi.mocked(api.reportBulletinComment).mockResolvedValue();
 render(<PostComments postId={4} onChanged={()=>{}}/>,{wrapper:createTestQueryClientWrapper()});await screen.findByText('Message 1');
 expect(screen.queryByText('Delete comment')).not.toBeInTheDocument();
 fireEvent.keyDown(screen.getByRole('button',{name:'More options for comment by Reader'}),{key:'ArrowDown'});
 fireEvent.click(await screen.findByRole('menuitem',{name:'Report comment'}));
 fireEvent.click(await screen.findByRole('button',{name:'Report comment'}));await waitFor(()=>expect(api.reportBulletinComment).toHaveBeenCalledWith(4,1,{reason:'harassment',details:''}));expect(screen.getByRole('status')).toHaveTextContent('Comment reported');
});
it('offers confirmed deletion only for the owner or a moderator',async()=>{
 vi.mocked(api.fetchPostComments).mockResolvedValue({data:[row(7,null,'Me')],page:1,hasMore:false});
 render(<PostComments postId={4} onChanged={()=>{}}/>,{wrapper:createTestQueryClientWrapper()});await screen.findByText('Message 7');
 fireEvent.keyDown(screen.getByRole('button',{name:'More options for comment by Me'}),{key:'ArrowDown'});fireEvent.click(await screen.findByRole('menuitem',{name:'Delete comment'}));await waitFor(()=>expect(api.deleteBulletinComment).toHaveBeenCalledWith(4,7));
});

it('prefills the reply mention, keeps an empty mention disabled, and cancels it cleanly',async()=>{
 render(<PostComments postId={4} onChanged={()=>{}}/>,{wrapper:createTestQueryClientWrapper()});await screen.findByText('Message 1');fireEvent.click(screen.getByRole('button',{name:'Reply'}));expect(screen.getByRole('textbox')).toHaveValue('@Reader ');expect(screen.getByRole('button',{name:'Post reply'})).toBeDisabled();fireEvent.click(screen.getByRole('button',{name:'Cancel reply'}));expect(screen.getByRole('textbox')).toHaveValue('');
});
it('shows a pending comment immediately and retries with the original submission reference',async()=>{
 let reject!:(error:Error)=>void;vi.mocked(api.createBulletinComment).mockImplementationOnce(()=>new Promise((_resolve,no)=>{reject=no;}));
 render(<PostComments postId={4} onChanged={()=>{}}/>,{wrapper:createTestQueryClientWrapper()});await screen.findByText('Message 1');fireEvent.change(screen.getByRole('textbox'),{target:{value:'Optimistic reply'}});fireEvent.click(screen.getByRole('button',{name:'Post comment'}));await screen.findByText('Optimistic reply',{selector:'p'});expect(screen.getByRole('textbox')).toBeDisabled();const reference=vi.mocked(api.createBulletinComment).mock.calls[0][3];reject(new Error('offline'));await screen.findByRole('button',{name:'Retry'});
 vi.mocked(api.createBulletinComment).mockResolvedValue(row(99,null,'Me'));fireEvent.click(screen.getByRole('button',{name:'Retry'}));await screen.findByText('Message 99');expect(api.createBulletinComment).toHaveBeenLastCalledWith(4,'Optimistic reply',undefined,reference);
});
it('opens a directly linked reply with its original parent and highlights it',async()=>{
 const root=row(1,null,'Reader',1),child=row(2,1,'Librarian',1),target=row(3,2,'Student');vi.mocked(api.fetchCommentContext).mockResolvedValue({comment:target,ancestors:[root,child]});
 render(<PostComments postId={4} linkedCommentId={3} onChanged={()=>{}}/>,{wrapper:createTestQueryClientWrapper()});await screen.findByText('Original comment');await screen.findByText('Message 3');expect(screen.getByText('Message 3').closest('article')).toHaveAttribute('data-highlight','true');
});
it('locks the composer and supports explicit chronological or helpful sorting',async()=>{
 const view=render(<PostComments postId={4} locked commentCount={8} onChanged={()=>{}}/>,{wrapper:createTestQueryClientWrapper()});await screen.findByText('Message 1');expect(screen.queryByRole('textbox')).not.toBeInTheDocument();expect(screen.getByText(/Comments are locked/)).toBeInTheDocument();fireEvent.change(screen.getByRole('combobox',{name:'Sort comments'}),{target:{value:'helpful'}});await waitFor(()=>expect(api.fetchPostComments).toHaveBeenCalledWith(4,null,1,expect.anything(),'helpful'));view.unmount();
});
it('keeps polled new comments behind a pill until the reader requests them',async()=>{
 vi.mocked(api.fetchPostComments).mockResolvedValue({data:[row(1,null,'Reader')],page:1,hasMore:false,latest_id:1});vi.mocked(api.fetchDiscussionUpdates).mockResolvedValue({latest_id:2,newest_other_id:2,new_count:1,comments_locked:false});vi.mocked(api.fetchCommentContext).mockResolvedValue({comment:row(2,null,'New reader'),ancestors:[]});
 render(<PostComments postId={4} onChanged={()=>{}}/>,{wrapper:createTestQueryClientWrapper()});await screen.findByRole('button',{name:'1 new comment'});expect(screen.queryByText('Message 2')).not.toBeInTheDocument();fireEvent.click(screen.getByRole('button',{name:'1 new comment'}));await screen.findByText('Message 2');
});
it('collapses the complete branch through its thread line and restores it',async()=>{
 render(<PostComments postId={4} onChanged={()=>{}}/>,{wrapper:createTestQueryClientWrapper()});await screen.findByText('Message 1');fireEvent.click(screen.getByRole('button',{name:'1 reply'}));await screen.findByText('Message 2');fireEvent.click(screen.getByRole('button',{name:'Collapse comment branch by Reader'}));expect(screen.queryByText('Message 1')).not.toBeInTheDocument();expect(screen.queryByText('Message 2')).not.toBeInTheDocument();fireEvent.click(screen.getByRole('button',{name:'Expand comment branch by Reader'}));await screen.findByText('Message 1');
});

it('sends Enter on desktop but leaves Shift+Enter and IME composition alone',async()=>{
 const original=window.matchMedia;window.matchMedia=vi.fn((query:string)=>({matches:query.includes('pointer: fine'),media:query,onchange:null,addListener:vi.fn(),removeListener:vi.fn(),addEventListener:vi.fn(),removeEventListener:vi.fn(),dispatchEvent:vi.fn()}));
 try{vi.mocked(api.createBulletinComment).mockResolvedValue(row(99,null,'Me'));render(<PostComments postId={4} onChanged={()=>{}}/>,{wrapper:createTestQueryClientWrapper()});await screen.findByText('Message 1');const field=screen.getByRole('textbox');fireEvent.change(field,{target:{value:'Keyboard comment'}});fireEvent.keyDown(field,{key:'Enter',shiftKey:true});fireEvent.keyDown(field,{key:'Enter',isComposing:true});expect(api.createBulletinComment).not.toHaveBeenCalled();fireEvent.keyDown(field,{key:'Enter'});await screen.findByText('Message 99');expect(api.createBulletinComment).toHaveBeenCalledTimes(1);}finally{window.matchMedia=original;}
});

it.each([0,'0',undefined])('removes the new-comments button when the remaining count is %s',async(count)=>{
 vi.mocked(api.fetchPostComments).mockResolvedValue({data:[row(1,null,'Reader')],page:1,hasMore:false,latest_id:1});
 vi.mocked(api.fetchDiscussionUpdates).mockResolvedValueOnce({latest_id:2,newest_other_id:2,new_count:1,comments_locked:false}).mockResolvedValue({latest_id:2,newest_other_id:0,new_count:count as any,comments_locked:false});
 vi.mocked(api.fetchCommentContext).mockResolvedValue({comment:row(2,null,'New reader'),ancestors:[]});
 render(<PostComments postId={4} onChanged={()=>{}}/>,{wrapper:createTestQueryClientWrapper()});fireEvent.click(await screen.findByRole('button',{name:'1 new comment'}));await screen.findByText('Message 2');await waitFor(()=>expect(screen.queryByRole('button',{name:/new comments?/})).not.toBeInTheDocument());
});

it('hides a text zero Helpful count and the menu on removed comments for readers',async()=>{
 vi.mocked(api.fetchPostComments).mockResolvedValue({data:[{...row(1,null,'Reader'),helpful_count:'0' as any},{...row(2,null,''),deleted_at:'2026-10-27T00:00:00Z'}],page:1,hasMore:false});
 render(<PostComments postId={4} onChanged={()=>{}}/>,{wrapper:createTestQueryClientWrapper()});await screen.findByText('Message 1');const helpful=screen.getByRole('button',{name:'Like 0 on comment by Reader'});expect(helpful).toHaveTextContent(/^Like$/);expect(screen.queryByRole('button',{name:'More options for comment by reader'})).not.toBeInTheDocument();
});
it('defaults to Top and uses a transient overlay for success feedback',async()=>{
 vi.mocked(api.reportBulletinComment).mockResolvedValue();render(<PostComments postId={4} commentCount={8} onChanged={()=>{}}/>,{wrapper:createTestQueryClientWrapper()});await screen.findByText('Message 1');expect(screen.getByRole('combobox',{name:'Sort comments'})).toHaveValue('helpful');expect(screen.getByRole('option',{name:'Top'})).toBeInTheDocument();fireEvent.keyDown(screen.getByRole('button',{name:'More options for comment by Reader'}),{key:'ArrowDown'});fireEvent.click(await screen.findByRole('menuitem',{name:'Report comment'}));fireEvent.click(await screen.findByRole('button',{name:'Report comment'}));await waitFor(()=>expect(screen.getByRole('status')).toHaveClass('post-feedback-toast'));
});

it('opens comment likers from the count using the limited reader identity',async()=>{
 vi.mocked(api.fetchPostComments).mockResolvedValue({data:[{...row(1,null,'Reader'),helpful_count:2}],page:1,hasMore:false});vi.mocked(api.fetchCommentLikers).mockResolvedValue({data:[{id:8,name:'Myra C.',role:'student',created_at:'2026-10-27'}],page:1,hasMore:false});
 render(<PostComments postId={4} onChanged={()=>{}}/>,{wrapper:createTestQueryClientWrapper()});fireEvent.click(await screen.findByRole('button',{name:'View 2 likes on comment by Reader'}));await screen.findByRole('heading',{name:'Liked by'});expect(await screen.findByText('Myra C.')).toBeInTheDocument();expect(api.fetchCommentLikers).toHaveBeenCalledWith(4,1,1,expect.anything());
});
it('keeps revision-required text in the composer without displaying it as a posted comment',async()=>{
 vi.mocked(api.createBulletinComment).mockRejectedValue({response:{data:{code:'COMMENT_REVISION_REQUIRED',message:'Please revise the language.'}}});render(<PostComments postId={4} onChanged={()=>{}}/>,{wrapper:createTestQueryClientWrapper()});await screen.findByText('Message 1');fireEvent.change(screen.getByRole('textbox'),{target:{value:'A draft to revise'}});fireEvent.click(screen.getByRole('button',{name:'Post comment'}));await screen.findByText('Please revise the language.');expect(screen.getByRole('textbox')).toHaveValue('A draft to revise');expect(screen.queryByText('A draft to revise',{selector:'p'})).not.toBeInTheDocument();
});
it('moves a held submission into the private review notice instead of the public thread',async()=>{
 vi.mocked(api.createBulletinComment).mockImplementation(async()=>{vi.mocked(api.fetchMyCommentReviews).mockResolvedValue({data:[{id:99,text:'A comment under review',created_at:'2026-10-27',moderation_status:'pending',moderation_reason:'Possible harmful language',case_status:'open',appealed_at:null}],page:1,hasMore:false});return {...row(99,null,''),text:'',hidden_at:'2026-10-27',moderation_status:'pending'};});
 render(<PostComments postId={4} onChanged={()=>{}}/>,{wrapper:createTestQueryClientWrapper()});await screen.findByText('Message 1');fireEvent.change(screen.getByRole('textbox'),{target:{value:'A comment under review'}});fireEvent.click(screen.getByRole('button',{name:'Post comment'}));await screen.findByText('Awaiting review');const privatePanel=screen.getByRole('region',{name:'Your comment reviews'});expect(privatePanel).toHaveTextContent('A comment under review');expect(screen.queryByText('Message 99')).not.toBeInTheDocument();expect(screen.getByRole('textbox',{name:'Write a comment'})).toHaveValue('');
});
it('offers no public copy menu on hidden comments even to their reader',async()=>{
 vi.mocked(api.fetchPostComments).mockResolvedValue({data:[{...row(1,null,''),hidden_at:'2026-10-27'}],page:1,hasMore:false});render(<PostComments postId={4} onChanged={()=>{}}/>,{wrapper:createTestQueryClientWrapper()});await screen.findByText('Comment hidden by staff');expect(screen.queryByRole('button',{name:/More options/})).not.toBeInTheDocument();
});

it('keeps report details and reason when the report request fails',async()=>{
 vi.mocked(api.reportBulletinComment).mockRejectedValue(new Error('offline'));render(<PostComments postId={4} onChanged={()=>{}}/>,{wrapper:createTestQueryClientWrapper()});await screen.findByText('Message 1');fireEvent.keyDown(screen.getByRole('button',{name:'More options for comment by Reader'}),{key:'ArrowDown'});fireEvent.click(await screen.findByRole('menuitem',{name:'Report comment'}));fireEvent.change(screen.getByRole('combobox',{name:'Reason'}),{target:{value:'threat'}});fireEvent.change(screen.getByRole('textbox',{name:'Details (optional)'}),{target:{value:'Please check the earlier reply.'}});fireEvent.click(screen.getByRole('button',{name:'Report comment'}));await screen.findByRole('alert');expect(screen.getByRole('textbox',{name:'Details (optional)'})).toHaveValue('Please check the earlier reply.');expect(screen.getByRole('combobox',{name:'Reason'})).toHaveValue('threat');
});

it('redacts loaded comments after moderation without inserting unseen comments',async()=>{
 vi.mocked(api.fetchPostComments).mockResolvedValue({data:[row(1,null,'Reader')],page:1,hasMore:false,latest_id:1});vi.mocked(api.fetchDiscussionUpdates).mockResolvedValue({latest_id:2,new_count:1,newest_other_id:2,comments_locked:false});vi.mocked(api.fetchCommentSnapshots).mockResolvedValue([{id:1,comment:null}]);render(<PostComments postId={4} onChanged={()=>{}}/>,{wrapper:createTestQueryClientWrapper()});await screen.findByRole('button',{name:'1 new comment'});await waitFor(()=>expect(screen.queryByText('Message 1')).not.toBeInTheDocument());expect(screen.queryByText('Message 2')).not.toBeInTheDocument();expect(api.fetchCommentSnapshots).toHaveBeenCalledWith(4,[1],expect.anything());
});
it('allows the author to withdraw a held comment while retaining its review evidence on the server',async()=>{
 vi.mocked(api.fetchMyCommentReviews).mockResolvedValue({data:[{id:99,text:'A held comment',created_at:'2026-10-27',moderation_status:'pending',moderation_reason:'Possible severe language',case_status:'open',appealed_at:null}],page:1,hasMore:false});vi.mocked(api.deleteBulletinComment).mockImplementation(async()=>{vi.mocked(api.fetchMyCommentReviews).mockResolvedValue({data:[],page:1,hasMore:false});});render(<PostComments postId={4} onChanged={()=>{}}/>,{wrapper:createTestQueryClientWrapper()});fireEvent.click(await screen.findByRole('button',{name:'Delete my comment'}));await waitFor(()=>expect(api.deleteBulletinComment).toHaveBeenCalledWith(4,99));await waitFor(()=>expect(screen.queryByText('A held comment')).not.toBeInTheDocument());
});
