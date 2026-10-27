import type {Pool,PoolConnection,RowDataPacket} from 'mysql2/promise';
// Include a removed ancestor only when it still connects a live descendant.
export function commentVisibility(rows:any[]){
 const byId=new Map(rows.map(row=>[Number(row.id),row]));const visible=new Set<number>();
 for(const row of rows){if(row.deleted_at||row.hidden_at)continue;let next:any=row;const path=new Set<number>();
  while(next&&!path.has(Number(next.id))){const id=Number(next.id);path.add(id);visible.add(id);next=next.parent_id?byId.get(Number(next.parent_id)):null;}
 }
 const children=new Map<number,number>();for(const row of rows)if(visible.has(Number(row.id))&&row.parent_id)children.set(Number(row.parent_id),(children.get(Number(row.parent_id))||0)+1);
 return {ids:[...visible],visible,children};
}
export async function visibleComments(conn:Pool|PoolConnection,postId:number){const [rows]=await conn.query<RowDataPacket[]>('SELECT id,parent_id,deleted_at,hidden_at FROM bulletin_comments WHERE post_id=?',[postId]);return commentVisibility(rows);}
