import {useMemo,useRef,useState} from 'react';
import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import {Sheet,SheetPortal,SheetOverlay,SheetTitle,SheetDescription} from '@/components/ui/sheet';
import * as SheetPrimitive from '@radix-ui/react-dialog';
import {LibraryDesignProvider} from '@/components/ui/library-design';
import {Link,useLocation} from 'react-router-dom';
import {useAuth} from '@/context/AuthContext';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {archiveBulletinPost,fetchBulletinPost,setBulletinPinned,setDiscussionLocked} from '../api';
import {toPost,getInitials,copyBulletinLink} from '../utils';
import {bulletinKeys} from '../bulletin.keys';
import type {PostModalProps} from './types/postModal.types';
import {useAdminConfirmDialog} from '@/features/admin';
import {RoleBadges} from './CommentIdentity';
import PostTimestamp from './PostTimestamp';
import PostModalActions from './PostModalActions';
import PostMediaGallery from './PostMediaGallery';
import PostComments from './PostComments';
import PostReactions from './PostReactions';
import {CreatePostModal} from './CreatePostModal';
import '../post-drawer.css';
import '../post-social.css';
export function PostModal(props:PostModalProps){return props.post?<PostReader key={props.post.id} {...props}/>:null;}
function PostReader(props:PostModalProps){
 const {user}=useAuth(),client=useQueryClient(),initial=props.post!,location=useLocation();
 const commentParam=new URLSearchParams(location.search).get('comment');const linkedCommentId=commentParam&&/^[1-9][0-9]*$/.test(commentParam)?Number(commentParam):undefined;
 const [shareFeedback,setShareFeedback]=useState('');
 const [edit,setEdit]=useState(false),[compact,setCompact]=useState(false),[login,setLogin]=useState(false);
 const titleRef=useRef<HTMLDivElement>(null), {confirm,confirmDialog}=useAdminConfirmDialog();
 const query=useQuery({queryKey:bulletinKeys.post(initial.id),queryFn:({signal})=>fetchBulletinPost(initial.id,signal),staleTime:0,retry:false});
 const post=useMemo(()=>query.data?toPost(query.data):initial,[query.data,initial]);
 const admin=['admin','super_admin'].includes(user?.role||''),canEdit=admin||(user?.role==='staff'&&user.id===post.author_id),canArchive=admin||user?.id===post.author_id;
 const pin=useMutation({mutationFn:()=>setBulletinPinned(post.id,!post.is_pinned),onSuccess:async()=>{props.onPinToggle?.(post.id,!post.is_pinned);await Promise.all([query.refetch(),client.invalidateQueries({queryKey:bulletinKeys.lists()})]);}});
 const archive=useMutation({mutationFn:()=>archiveBulletinPost(post.id),onSuccess:async()=>{await client.invalidateQueries({queryKey:bulletinKeys.lists()});props.onArchived?.(post.id);props.onClose();}});
 const lock=useMutation({mutationFn:()=>setDiscussionLocked(post.id,!post.comments_locked),onSuccess:async()=>{await Promise.all([query.refetch(),client.invalidateQueries({queryKey:['bulletin-discussion-updates',post.id]})]);}});
 const images=useMemo(()=>[...(post.image_url?[{url:post.image_url,alt:post.image_alt||''}]:[]),...(post.gallery||[])],[post.image_url,post.image_alt,post.gallery]);
 const summary=useMemo(()=>({reaction_counts:post.reaction_counts||{like:post.likes,helpful:0,thanks:0,interested:0},helpful_count:post.helpful_count,helpful_by_me:post.helpful_by_me,saved_by_me:post.saved_by_me,interested_count:post.interested_count,interested_by_me:post.interested_by_me,reaction_total:post.reaction_total??post.likes,my_reaction:post.my_reaction??(post.liked_by_me?'like' as const:null),likes:post.likes,liked_by_me:post.liked_by_me}),[post]);
 const requireLogin=()=>{if(props.onRequireLogin)props.onRequireLogin();else setLogin(true);};
 const unavailable=query.isError&&[403,404].includes((query.error as any)?.response?.status);
 return <LibraryDesignProvider><Sheet open onOpenChange={open=>{if(!open)props.onClose();}}><SheetPortal><SheetOverlay className="post-drawer-backdrop"/><SheetPrimitive.Content data-library-design data-library-ui="sheet" className="bulletin-post-drawer" onScroll={event=>{const title=titleRef.current;if(title)setCompact(title.getBoundingClientRect().bottom<event.currentTarget.getBoundingClientRect().top+64);}}><div className="post-drawer-toolbar"><span className="post-sticky-title" aria-hidden={!compact}>{compact&&<><strong>{post.title}</strong><small>{post.comment_count} comments</small></>}</span><PostModalActions canPin={admin&&!unavailable} pinned={post.is_pinned} pinBusy={pin.isPending} handlePin={()=>pin.mutate()} canArchive={canArchive&&!unavailable} archiveBusy={archive.isPending} handleArchive={()=>{void confirm({title:'Archive post?',description:'This post will no longer be visible on the bulletin.',actionLabel:'Archive post',cancelLabel:'Keep post',tone:'danger'}).then(approved=>{if(approved)archive.mutate();});}} onCopy={()=>{void copyBulletinLink(post.id).then(()=>setShareFeedback('Post link copied.')).catch(()=>setShareFeedback('Could not copy the link. Try again.'));}} canLock={canEdit&&!unavailable} locked={post.comments_locked} lockBusy={lock.isPending} onLock={()=>{void confirm({title:post.comments_locked?'Unlock comments?':'Lock comments?',description:post.comments_locked?'Readers will be able to add comments and replies again.':'Existing comments stay visible. New comments and replies will be paused.',actionLabel:post.comments_locked?'Unlock comments':'Lock comments',cancelLabel:'Cancel'}).then(approved=>{if(approved)lock.mutate();});}} onClose={props.onClose} canEdit={canEdit&&!unavailable&&Boolean(query.data)} onEdit={()=>setEdit(true)}/></div><div ref={titleRef} className="post-drawer-heading"><SheetTitle className="post-drawer-title">{unavailable?'Post unavailable':post.title}</SheetTitle><SheetDescription className="sr-only">Library bulletin post.</SheetDescription>{!unavailable&&<div className="post-drawer-byline">{post.is_pinned&&<span className="post-drawer-chip">Pinned</span>}<span className="post-drawer-avatar" aria-hidden="true">{getInitials(post.author_name)}</span><b>{post.author_name}</b><RoleBadges role={post.author_role}/><PostTimestamp value={post.created_at||post.date} editedAt={post.edited_at}/></div>}</div>
 {unavailable?<p className="post-drawer-error" role="status">This post is no longer available.</p>:<>{query.isError&&<p className="post-drawer-error" role="alert">Could not refresh this post. <button type="button" onClick={()=>void query.refetch()}>Try again</button></p>}{(pin.isError||archive.isError||lock.isError)&&<p className="post-drawer-error" role="alert">Could not update the post. Try again.</p>}<div className="post-drawer-body">{post.content}</div><PostMediaGallery images={images} title={post.title} compact={post.content.length>600||post.content.split('\n').length>8}/><PostReactions postType={post.post_type} commentCount={post.comment_count} onOpenComments={()=>document.querySelector('.post-discussion-heading')?.scrollIntoView({block:'start',behavior:'smooth'})} postId={post.id} summary={summary} onRequireLogin={requireLogin}/><PostComments postAuthorId={post.author_id} commentCount={post.comment_count} locked={post.comments_locked} linkedCommentId={linkedCommentId} postId={post.id} onChanged={()=>{}} onRequireLogin={requireLogin}/></>}
 <span className="sr-only" role="status" aria-live="polite">{shareFeedback}</span></SheetPrimitive.Content></SheetPortal></Sheet><CreatePostModal open={edit} onClose={()=>setEdit(false)} post={post} onCreated={()=>{setEdit(false);void query.refetch();}}/><Dialog open={login} onOpenChange={setLogin}><DialogContent><DialogTitle>Join the discussion</DialogTitle><DialogDescription>Sign in to react or reply to library posts.</DialogDescription><Link to="/login">Sign in</Link></DialogContent></Dialog>{confirmDialog}</LibraryDesignProvider>;
}
