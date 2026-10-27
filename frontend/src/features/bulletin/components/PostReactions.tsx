import {useEffect,useState} from 'react';
import {useInfiniteQuery,useMutation,useQueryClient} from '@tanstack/react-query';
import {Link} from 'react-router-dom';
import {LibraryIcon} from '@/components/ui/library-icon';
import {Info} from '@/components/ui/library-glyphs';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {Popover,PopoverTrigger,PopoverContent} from '@/components/ui/popover';
import {useAuth} from '@/context/AuthContext';
import {fetchPostReactors,setPostHelpful,setPostSaved,setPostInterest} from '../api';
import type {ReactionSummary} from '../types';
import {bulletinKeys} from '../bulletin.keys';
import {useBulletinAnnouncement} from './useBulletinAnnouncement';
function normalize(summary:ReactionSummary){return {...summary,helpful_count:Number(summary.helpful_count??summary.reaction_total??summary.likes??0),helpful_by_me:Boolean(Number(summary.helpful_by_me??summary.liked_by_me)),saved_by_me:Boolean(Number(summary.saved_by_me)),interested_count:Number(summary.interested_count??summary.reaction_counts?.interested??0),interested_by_me:Boolean(Number(summary.interested_by_me))};}
export default function PostReactions({postId,postType='announcement',summary,onRequireLogin,commentCount=0,onOpenComments}:{postId:number;postType?:string;summary:ReactionSummary;onRequireLogin?:()=>void;commentCount?:number;onOpenComments?:()=>void}){
 const {user}=useAuth(),client=useQueryClient(),[current,setCurrent]=useState(()=>normalize(summary)),[people,setPeople]=useState<'helpful'|'interested'|null>(null),[announcement,announce]=useBulletinAnnouncement();
 useEffect(()=>setCurrent(normalize(summary)),[summary]);
 useEffect(()=>{if(!user)setPeople(null);},[user]);
 const mutation=useMutation({
  mutationFn:async(action:'helpful'|'save'|'interest')=>({action,result:action==='save'?await setPostSaved(postId,!current.saved_by_me):action==='interest'?await setPostInterest(postId,!current.interested_by_me):await setPostHelpful(postId,!current.helpful_by_me)}),
  onMutate:async action=>{
   if(action!=='helpful')return null;
   await client.cancelQueries({queryKey:bulletinKeys.post(postId)});
   const previous=current,previousPost=client.getQueryData<any>(bulletinKeys.post(postId)),selected=!current.helpful_by_me;
   const optimistic={...current,helpful_by_me:selected,helpful_count:Math.max(0,current.helpful_count+(selected?1:-1))};
   setCurrent(optimistic);client.setQueryData(bulletinKeys.post(postId),(old:any)=>old?{...old,...optimistic}:old);
   return {previous,previousPost};
  },
  onError:(_error,action,context)=>{
   if(action!=='helpful'||!context?.previous)return;
   setCurrent(context.previous);
   if(context.previousPost!==undefined)client.setQueryData(bulletinKeys.post(postId),context.previousPost);
  },
  onSuccess:({action,result})=>{
   setCurrent(old=>normalize({...old,...result}));client.setQueryData(bulletinKeys.post(postId),(old:any)=>old?{...old,...result}:old);
   void client.invalidateQueries({queryKey:bulletinKeys.lists()});void client.invalidateQueries({queryKey:['bulletin-reactors',postId]});
   if(action==='save'){void client.invalidateQueries({queryKey:['bulletin-saved',user?.id]});announce(result.saved_by_me?'Saved to My Library.':'Removed from saved posts.');}
  },
  onSettled:(_result,_error,action)=>{if(action==='helpful')void client.invalidateQueries({queryKey:bulletinKeys.post(postId)});},
 });
 const readers=useInfiniteQuery({queryKey:['bulletin-reactors',postId,people],initialPageParam:1,queryFn:({pageParam,signal})=>fetchPostReactors(postId,people||'helpful',pageParam,signal),getNextPageParam:last=>last.hasMore?last.page+1:undefined,enabled:Boolean(people&&user)});
 const actionError=(mutation.error as {response?:{data?:{message?:unknown}}}|null)?.response?.data?.message;
 const act=(action:'helpful'|'save'|'interest')=>{if(!user){onRequireLogin?.();return;}mutation.mutate(action);};
 return <><section className="post-purpose-actions" aria-label="Post actions"><div className="post-action-summary">{current.helpful_count>0&&<><button type="button" disabled={!current.helpful_count} aria-label="View people who liked this post" onClick={()=>user?setPeople('helpful'):onRequireLogin?.()}><span className="post-action-count">{current.helpful_count}</span> {current.helpful_count===1?'like':'likes'}</button><span aria-hidden="true">·</span></>}<button type="button" onClick={onOpenComments}>{commentCount} {commentCount===1?'comment':'comments'}</button><Popover><PopoverTrigger asChild><button className="post-count-info" type="button" aria-label="About comment totals"><Info aria-hidden="true"/></button></PopoverTrigger><PopoverContent collisionPadding={12} className="post-time-details" aria-label="About comment totals" side="top"><p>Totals include comments and replies that haven’t been removed. Removed comments are excluded. Staff-hidden and held comments are also excluded; placeholders may remain to keep visible replies in context.</p></PopoverContent></Popover></div><div className="post-action-controls"><button type="button" className="post-like-control" aria-label={current.helpful_by_me?'Liked':'Like'} aria-pressed={current.helpful_by_me} disabled={mutation.isPending} onClick={()=>act('helpful')}><LibraryIcon name="like" className="post-social-glyph"/><span>{current.helpful_by_me?'Liked':'Like'}</span></button><button type="button" className="post-save-control" aria-label={current.saved_by_me?'Saved to My Library':'Save to My Library'} aria-pressed={current.saved_by_me} disabled={mutation.isPending} onClick={()=>act('save')}><LibraryIcon name="save" className="post-social-glyph"/><span>{current.saved_by_me?'Saved':'Save'}</span></button>{postType==='event'&&<><button type="button" aria-label="Interested in this event" aria-pressed={current.interested_by_me} disabled={mutation.isPending} onClick={()=>act('interest')}><span>Interested</span><LibraryIcon name="interest"/>{current.interested_by_me&&<span className="post-action-selected" aria-hidden="true">✓</span>}</button>{current.interested_count>0&&<button type="button" className="post-interest-count" onClick={()=>user?setPeople('interested'):onRequireLogin?.()}><span className="post-action-count">{current.interested_count}</span> interested</button>}</>}{current.saved_by_me&&<Link to="/my-library?view=saved" className="post-saved-destination">View saved posts</Link>}</div>{mutation.isError&&<p role="alert">{typeof actionError==='string'?actionError:'Could not save this action. Your previous selection is kept. Try again.'}</p>}<p role="status" aria-live="polite" className="sr-only">{announcement}</p></section><Dialog open={Boolean(people)} onOpenChange={open=>{if(!open)setPeople(null);}}><DialogContent className="post-reactors-dialog"><DialogTitle>{people==='interested'?'Interested in this event':'Liked by'}</DialogTitle><DialogDescription>{people==='interested'?'Interest helps library staff plan. It is not a booking or registration.':'Readers who liked this post.'}</DialogDescription>{readers.isPending?<p role="status">Loading readers…</p>:readers.isError?<p role="alert">Could not load readers. <button type="button" onClick={()=>void readers.refetch()}>Try again</button></p>:<ul>{readers.data?.pages.flatMap(page=>page.data).map(person=><li key={person.id}><span><strong>{person.name}</strong><small>{person.role.replace(/_/g,' ')}</small></span></li>)}</ul>}{readers.data&&!readers.data.pages[0].data.length&&<p>No readers yet.</p>}{readers.hasNextPage&&<button type="button" disabled={readers.isFetchingNextPage} onClick={()=>void readers.fetchNextPage()}>More people</button>}</DialogContent></Dialog></>;
}
