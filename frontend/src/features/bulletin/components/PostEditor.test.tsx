// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {createTestQueryClientWrapper} from '@/test-utils/query-client';
import {CreatePostModal} from './CreatePostModal';
import * as api from '../api';
vi.mock('@/context/AuthContext',()=>({useAuth:()=>({user:{id:7,role:'staff'}})}));
vi.mock('@/features/admin/public',()=>({useAdminConfirmDialog:()=>({confirm:async()=>true,confirmDialog:null})}));
vi.mock('@/features/notifications/usePublicationNotice',()=>({usePublicationNotice:()=>({reset:()=>{},confirmDialog:null})}));
vi.mock('@/hooks/useCloudinaryUpload',()=>({useCloudinaryUpload:()=>({upload:vi.fn(),uploading:false})}));
vi.mock('../api',()=>({editBulletinPost:vi.fn(),createBulletinPost:vi.fn(),fetchBulletinPost:vi.fn()}));
const post={id:4,title:'Original',content:'Original body',content_revision:3,author_id:7,image_url:'https://example.test/cover.jpg',image_alt:'Cover',gallery:[{url:'https://example.test/second.jpg',alt:'Second'}]} as any;
beforeEach(()=>vi.resetAllMocks());afterEach(cleanup);
it('reuses the editor for existing posts and preserves edits on a conflict',async()=>{
 const close=vi.fn();vi.mocked(api.editBulletinPost).mockRejectedValue({response:{status:409,data:{message:'This post changed. Reload latest.'}}});
 render(<CreatePostModal open post={post} onClose={close} onCreated={()=>{}}/>,{wrapper:createTestQueryClientWrapper()});
 fireEvent.change(screen.getByLabelText('Title'),{target:{value:'Updated title'}});fireEvent.click(screen.getByRole('button',{name:'Move image 2 earlier'}));fireEvent.click(screen.getByRole('button',{name:'Save changes'}));
 await screen.findByRole('alert');expect(screen.getByLabelText('Title')).toHaveValue('Updated title');expect(close).not.toHaveBeenCalled();
 expect(api.editBulletinPost).toHaveBeenCalledWith(4,expect.objectContaining({title:'Updated title',content_revision:3,image_url:'https://example.test/second.jpg',gallery:[expect.objectContaining({url:'https://example.test/cover.jpg'})]}));
 expect(api.createBulletinPost).not.toHaveBeenCalled();expect(screen.getByRole('button',{name:'Reload latest post'})).toBeInTheDocument();
},15000);

it('requires an author description before an image can be published',async()=>{
 render(<CreatePostModal open post={post} onClose={()=>{}} onCreated={()=>{}}/>,{wrapper:createTestQueryClientWrapper()});
 const description=screen.getAllByLabelText('Image description (required)')[0];expect(description).toBeRequired();fireEvent.change(description,{target:{value:'   '}});
 fireEvent.submit(screen.getByLabelText('Title').closest('form')!);await screen.findByText('Add a description for each image before publishing.');expect(api.editBulletinPost).not.toHaveBeenCalled();
});
