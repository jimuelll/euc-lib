import {Check,Clock,AlertTriangle,MinusCircle,Asterisk,Lock,Pencil,Eye,EyeOff} from 'lucide-react';
import './admin-status-chip.css';
export function AdminStatusChip({children,tone='neutral',title,icon}:{children:React.ReactNode;tone?:'success'|'warning'|'danger'|'neutral';title?:string;icon?:'alert'|'required'|'system'|'custom'|'unused'|'public'|'hidden'}){
 const named={alert:AlertTriangle,required:Asterisk,system:Lock,custom:Pencil,unused:MinusCircle,public:Eye,hidden:EyeOff};
 const Icon=icon?named[icon]:tone==='success'?Check:tone==='warning'?Clock:tone==='danger'?AlertTriangle:MinusCircle;
 return <span className="admin-status-chip" data-tone={tone} title={title}><Icon aria-hidden="true"/>{children}</span>;
}
