// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {MemoryRouter} from 'react-router-dom';
import {createTestQueryClientWrapper} from '@/test-utils/query-client';
import AdminModeration from './AdminModeration';
import {ModerationAttention} from './ModerationAttention';
import * as api from './api';
const auth=vi.hoisted(()=>({role:'admin'}));
vi.mock('@/context/AuthContext',()=>({useAuth:()=>({user:{id:7,role:auth.role}})}));
vi.mock('./api',()=>({fetchModerationStats:vi.fn(),fetchReviewCases:vi.fn(),fetchReviewCase:vi.fn(),reviewComment:vi.fn()}));
vi.mock('@/features/admin',()=>({AdminPageHeader:({title}:any)=><h1>{title}</h1>,AdminEmptyState:({title,description}:any)=><div><h2>{title}</h2><p>{description}</p></div>,AdminDetailDrawer:({open,children}:any)=>open?<section aria-label="Review case">{children}</section>:null}));
const item={id:3,comment_id:8,post_id:4,status:'open',priority:'urgent',source:'screening',snapshot_text:'Synthetic flagged comment',screening_reason:'Possible threat',resolution_reason:null,revision:7,created_at:'2026-10-28T00:00:00Z',opened_at:'2026-10-28T00:00:00Z',resolved_at:null,post_title:'Library news',author_name:'Reader',report_count:0,author_id:9,parent_id:null,deleted_at:null,hidden_at:'2026-10-28T00:00:00Z',post_archived_at:null,moderation_status:'pending',moderation_reason:'Possible threat',reports:[],actions:[],context:[],context_has_more:false} as api.ReviewDetail;
beforeEach(()=>{vi.resetAllMocks();auth.role='admin';vi.mocked(api.fetchModerationStats).mockResolvedValue({pending:1,urgent:1,oldest:item.opened_at});vi.mocked(api.fetchReviewCases).mockResolvedValue({data:[item],page:1,hasMore:false});vi.mocked(api.fetchReviewCase).mockResolvedValue(item);});afterEach(cleanup);
const mount=(node=<AdminModeration/>,url='/admin/moderation?case=3')=>render(<MemoryRouter initialEntries={[url]}>{node}</MemoryRouter>,{wrapper:createTestQueryClientWrapper()});
it('requires a decision and reason, preserves notes on conflict, and sends the reviewed revision',async()=>{
 vi.mocked(api.reviewComment).mockRejectedValue({response:{data:{message:'This case changed. Reload it before deciding.'}}});mount();await screen.findByText('Comment under review');const save=screen.getByRole('button',{name:'Record decision'});expect(save).toBeDisabled();fireEvent.change(screen.getByRole('combobox',{name:'Decision'}),{target:{value:'restore'}});fireEvent.change(screen.getByRole('textbox',{name:'Reason'}),{target:{value:'Reviewed the surrounding conversation.'}});fireEvent.click(save);await screen.findByRole('alert');expect(api.reviewComment).toHaveBeenCalledWith(3,{action:'restore',reason:'Reviewed the surrounding conversation.',revision:7});expect(screen.getByRole('textbox',{name:'Reason'})).toHaveValue('Reviewed the surrounding conversation.');expect(screen.getByRole('button',{name:'Reload case'})).toBeInTheDocument();expect(screen.queryByRole('option',{name:'Dismiss reports / close case'})).not.toBeInTheDocument();
});
it('highlights unresolved cases for administrators and hides the notice at zero or for staff',async()=>{
 const view=mount(<ModerationAttention/>);expect(await screen.findByRole('link',{name:/1 comment needs review/})).toHaveAttribute('href','/admin/moderation');view.unmount();vi.mocked(api.fetchModerationStats).mockResolvedValue({pending:0,urgent:0,oldest:null});const empty=mount(<ModerationAttention/>);await waitFor(()=>expect(api.fetchModerationStats).toHaveBeenCalledTimes(2));expect(screen.queryByRole('link')).not.toBeInTheDocument();empty.unmount();auth.role='staff';mount(<ModerationAttention/>);expect(screen.queryByRole('link')).not.toBeInTheDocument();expect(api.fetchModerationStats).toHaveBeenCalledTimes(2);
});
it('keeps historical deleted evidence reviewable without offering restoration',async()=>{
 vi.mocked(api.fetchReviewCase).mockResolvedValue({...item,deleted_at:item.opened_at,moderation_status:'pending'});mount();await screen.findByText('Comment under review');expect(screen.getByText('Synthetic flagged comment',{selector:'blockquote'})).toBeInTheDocument();expect(screen.queryByRole('option',{name:'Restore comment'})).not.toBeInTheDocument();expect(screen.queryByRole('option',{name:'Hide comment'})).not.toBeInTheDocument();expect(screen.getByRole('option',{name:'Dismiss reports / close case'})).toBeInTheDocument();
});

it('requires an independent reviewer for an administrator’s own comment',async()=>{
 vi.mocked(api.fetchReviewCase).mockResolvedValue({...item,can_review:false});mount();await screen.findByText(/Another administrator must review reports/);expect(screen.queryByRole('button',{name:'Record decision'})).not.toBeInTheDocument();expect(api.reviewComment).not.toHaveBeenCalled();
});

it('distinguishes an archived post from a publicly visible comment',async()=>{
 vi.mocked(api.fetchReviewCase).mockResolvedValue({...item,post_archived_at:item.opened_at,hidden_at:null,moderation_status:'published'});mount();await screen.findByText('The post is archived; this comment is not publicly available.');expect(screen.queryByText('Currently visible to readers.')).not.toBeInTheDocument();
});

it('retains withdrawn evidence without asking for another decision',async()=>{
 vi.mocked(api.fetchReviewCase).mockResolvedValue({...item,status:'withdrawn',deleted_at:item.opened_at});mount();await screen.findByText('Comment under review');expect(screen.getByText(/The author withdrew this automatically held comment/)).toBeInTheDocument();expect(screen.queryByRole('button',{name:'Record decision'})).not.toBeInTheDocument();expect(screen.getByRole('option',{name:'Withdrawn'})).toBeInTheDocument();expect(screen.getByText('Synthetic flagged comment',{selector:'blockquote'})).toBeInTheDocument();
});
