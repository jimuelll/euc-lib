import { Camera, LogIn, LogOut, Keyboard } from "lucide-react";
import type { AttendanceType } from "../types";
interface Props {onStart:(type:AttendanceType)=>void;onManual:()=>void;processing:boolean;}
export default function IdleView({onStart,onManual,processing}:Props){return <div className="kiosk-choose"><div className="kiosk-choose-hint"><strong>Tap one to start</strong><span><Camera size={18} aria-hidden="true"/>Opens the camera right away</span></div><div className="kiosk-attendance-modes" role="group" aria-label="Start attendance scanning">
 {([{type:"check_in",label:"Time in",detail:"Arrival",Icon:LogIn},{type:"check_out",label:"Time out",detail:"Departure",Icon:LogOut}] as const).map(({type,label,detail,Icon})=><button type="button" key={type} disabled={processing} onClick={()=>onStart(type)}><Icon aria-hidden="true" strokeWidth={1.6}/><strong>{label}</strong>{" "}<span>{detail}</span></button>)}
 </div><button type="button" className="kiosk-manual-choice" onClick={onManual} disabled={processing}><Keyboard size={16} aria-hidden="true"/>Enter ID manually</button></div>;}
