import {getInitials} from '../utils';
export function BulletinAvatar({name,removed=false}:{name:string;removed?:boolean}){return <span className={`post-comment-avatar${removed?' is-removed':''}`} aria-hidden="true">{removed?'—':getInitials(name||'Reader')}</span>;}
export function RoleBadges({role,author=false}:{role?:string;author?:boolean}){
 const label=role==='super_admin'?'Super admin':role==='admin'?'Admin':role==='staff'?'Staff':'';
 if(author)return <span className="post-role-badge is-author" title={label?`Post author · ${label}`:'Post author'}>Author</span>;
 return label?<span className="post-role-badge">{label}</span>:null;
}
