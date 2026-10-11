import { Loader2, Save, Send, Undo2 } from "@/components/ui/library-glyphs";
import { Button } from "@/components/ui/button";
import { formatContentDate } from "./PublishingFields";
export interface PublishingFooterProps {
 hasPublished?:boolean;scope:string;unsavedCount:number;dirty:boolean;hasDraft:boolean;savedAt:string|null;lastPublished:string|null;busy:string;message:string;error:boolean;onDiscard:()=>void;onSave:()=>void;onPublish:()=>void;disabled?:boolean;publishLabel?:string;
}
export default function PublishingFooter(props:PublishingFooterProps){
 const pending=Boolean(props.busy)||props.disabled;
 const status=props.disabled?"Loading editor…":props.dirty?`${props.unsavedCount} unsaved ${props.unsavedCount===1?"change":"changes"}`:props.hasDraft?"Draft saved":"Published";
 return <footer className="publishing-footer" aria-label={`${props.scope} publishing controls`}><div className="publishing-footer-status"><p role={props.error?"alert":"status"}><strong>{props.scope}</strong> · {props.message||status}</p><p className="content-secondary">{props.lastPublished?`Last published · ${formatContentDate(props.lastPublished)}`:props.hasPublished?"Last published · —":"Never published"}</p></div><div className="publishing-footer-actions">
 <Button variant="outline" disabled={pending||(!props.dirty&&!props.hasDraft)} onClick={props.onDiscard}><Undo2/>Discard</Button>
 <Button variant="outline" disabled={pending||!props.dirty} onClick={props.onSave}>{props.busy==="draft"?<Loader2 className="animate-spin motion-reduce:animate-none"/>:<Save/>}Save draft</Button>
 <Button className="publishing-primary" disabled={pending||(!props.dirty&&!props.hasDraft)} onClick={props.onPublish}>{props.busy==="publish"?<Loader2 className="animate-spin motion-reduce:animate-none"/>:<Send/>}{props.publishLabel||"Publish"}</Button>
 </div></footer>;
}
