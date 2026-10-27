// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {afterEach,expect,it,vi} from 'vitest';
import {PostCard} from './PostCard';
import type {BulletinPost} from '../types';
vi.mock('@/context/AuthContext',()=>({useAuth:()=>({user:null})}));
afterEach(cleanup);
const post={id:4,title:'Library news',content:'A new reading space.',date:'2026-10-27T00:00:00Z',author_name:'Librarian',author_id:2,author_role:'staff',likes:1,liked_by_me:true,comment_count:5,is_pinned:false,post_type:'announcement',comments:[]} satisfies BulletinPost;
it.each(['notice-featured','grid'] as const)('shows the current Like state on %s cards while keeping the card open action',variant=>{
 const open=vi.fn();const {container,rerender}=render(<PostCard post={post} variant={variant} onClick={open}/>);
 expect(container.querySelector('.bulletin-like-stat')).toHaveAttribute('data-liked','true');
 expect(screen.getAllByRole('button')).toHaveLength(1);
 fireEvent.click(container.querySelector('.bulletin-like-stat')!);expect(open).toHaveBeenCalledOnce();
 // Explicit current state takes precedence over an older legacy selection.
 rerender(<PostCard post={{...post,helpful_by_me:false,helpful_count:0}} variant={variant} onClick={open}/>);
 expect(container.querySelector('.bulletin-like-stat')).toHaveAttribute('data-liked','false');
 expect(container.querySelector('.bulletin-like-stat')).toHaveTextContent('0');
});
