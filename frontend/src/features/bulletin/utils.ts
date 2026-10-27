import type { ApiPost, BulletinPost } from "./types";

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function toPost(raw: ApiPost): BulletinPost {
  let gallery:{url:string;alt:string}[]=[];try{gallery=typeof raw.gallery==="string"?JSON.parse(raw.gallery):raw.gallery||[];}catch{/* Keep the empty gallery when saved data is malformed. */}
  return {
    id:            raw.id,
    edited_at:raw.edited_at,content_revision:raw.content_revision,image_public_id:raw.image_public_id,reaction_counts:raw.reaction_counts,reaction_total:raw.reaction_total,my_reaction:raw.my_reaction,
    title:         raw.title,
    date:          formatDate(raw.created_at),
    created_at: raw.created_at,
    helpful_count:raw.helpful_count,helpful_by_me:raw.helpful_by_me,saved_by_me:raw.saved_by_me,interested_count:raw.interested_count,interested_by_me:raw.interested_by_me,
    comments_locked:Boolean(raw.comments_locked),
    content:       raw.content,
    image_url:     raw.image_url,
    image_alt: raw.image_alt,
    gallery: Array.isArray(gallery)?gallery:[],
    likes:         raw.likes,
    liked_by_me:   Boolean(raw.liked_by_me),
    comment_count: raw.comment_count,
    author_id:     raw.author_id,
    author_name:   raw.author_name,
    author_role:   raw.author_role,
    comments:      [],
    is_pinned:     Boolean(raw.is_pinned),
    post_type: raw.post_type ?? "announcement",
    event_starts_at: raw.event_starts_at,
    event_ends_at: raw.event_ends_at,
    event_location: raw.event_location,
    event_registration_url: raw.event_registration_url,
  };
}

export function bulletinDisplayName(name:string,role?:string){
 if(role!=='student')return name;
 const words=String(name||'').trim().split(/\s+/).filter(Boolean);
 return words.length>1?`${words[0]} ${Array.from(words[words.length-1])[0].toLocaleUpperCase()}.`:words[0]||'Reader';
}
export function bulletinLink(postId:number,commentId?:number){
 const url=new URL('/bulletin',window.location.origin);url.searchParams.set('post',String(postId));if(commentId)url.searchParams.set('comment',String(commentId));return url.href;
}
export async function copyBulletinLink(postId:number,commentId?:number){
 const value=bulletinLink(postId,commentId);
 if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(value);return;}
 const field=document.createElement('textarea');field.value=value;field.style.position='fixed';field.style.opacity='0';document.body.append(field);field.select();try{if(!document.execCommand('copy'))throw new Error('Copy unavailable');}finally{field.remove();}
}
