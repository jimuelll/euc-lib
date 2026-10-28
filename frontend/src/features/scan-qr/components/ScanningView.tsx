import { useEffect, useRef, useState, type FormEvent } from "react";
import { Camera, Keyboard, Loader2, AlertTriangle, X } from "lucide-react";
import { useZxingScanner } from "../hooks/useZxingScanner";
import type { AttendanceType, ScanMode } from "../types";
import IdleView from "./IdleView";
interface Props {attendanceType:AttendanceType;onSelect:(type:AttendanceType)=>void;onStart:(type:AttendanceType)=>void;onStop:()=>void;onScanned:(value:string)=>void;scanMode:ScanMode;cameraEnabled:boolean;}
const interactive=(target:EventTarget|null)=>target instanceof Element&&Boolean(target.closest('button,a,input,select,textarea,[role="menuitem"],[role="menu"],[role="dialog"]'));
export default function ScanningView({attendanceType,onSelect,onStart,onStop,onScanned,scanMode,cameraEnabled}:Props){
 const [manual,setManual]=useState(false),[value,setValue]=useState("");const [facing,setFacing]=useState<"environment"|"user">("environment"),[videoReady,setVideoReady]=useState(false),[restartKey,setRestartKey]=useState(0);
 const inputRef=useRef<HTMLInputElement>(null);const processing=scanMode==="processing",covered=["success","notice","error"].includes(scanMode);
 const {videoRef,error:cameraError}=useZxingScanner({onResult:onScanned,active:cameraEnabled,continuous:true,paused:processing||covered,facingMode:facing,restartKey});
 useEffect(()=>{setVideoReady(false);},[cameraEnabled,facing,restartKey]);
 useEffect(()=>{if(!processing&&!covered)setValue("");},[scanMode,processing,covered]);
 useEffect(()=>{
  if(processing||covered)return;let timer:ReturnType<typeof setTimeout>|undefined;
  const focus=()=>{if(document.visibilityState!=="hidden"&&!document.querySelector('[role="menu"][data-state="open"],[role="dialog"]'))inputRef.current?.focus({preventScroll:true});};
  const wedge=(event:KeyboardEvent)=>{const target=event.target instanceof Element?event.target:null;if(!manual&&event.key.length===1&&event.key!==" "&&!event.ctrlKey&&!event.altKey&&!event.metaKey&&!target?.closest('input,textarea,[contenteditable="true"],[role="menu"],[role="menuitem"],[role="dialog"]')){event.preventDefault();setValue(current=>current+event.key);focus();}};
  const pointer=(event:PointerEvent)=>{if(!interactive(event.target))timer=setTimeout(focus,0);};
  focus();window.addEventListener("focus",focus);document.addEventListener("visibilitychange",focus);document.addEventListener("keydown",wedge);document.addEventListener("pointerup",pointer);
  return()=>{window.removeEventListener("focus",focus);document.removeEventListener("visibilitychange",focus);document.removeEventListener("keydown",wedge);document.removeEventListener("pointerup",pointer);if(timer)clearTimeout(timer);};
 },[processing,covered,attendanceType,manual]);
 const submit=(event:FormEvent)=>{event.preventDefault();if(!processing&&!covered&&value.trim())onScanned(value.trim());};
 const modeSwitch=<div className="kiosk-mode-switch" role="group" aria-label="Attendance mode">{([['check_in','Time in'],['check_out','Time out']] as const).map(([type,label])=><button type="button" key={type} disabled={processing} aria-pressed={attendanceType===type} onClick={()=>onSelect(type)}>{label}</button>)}</div>;
 return <div className={`kiosk-scanning-layer ${covered?'is-covered':''}`} aria-hidden={covered||undefined}>
  {cameraEnabled?<div className="kiosk-live-view">
    <video ref={videoRef} autoPlay muted playsInline onPlaying={()=>setVideoReady(true)} aria-label="ID scanning camera" style={{transform:facing==="user"?"scaleX(-1)":undefined}}/>
    <div className="kiosk-camera-toolbar">{modeSwitch}<div><span className={`kiosk-camera-status ${videoReady&&!cameraError?'is-live':''}`} aria-label={cameraError?'Camera unavailable':videoReady?'Camera live':'Camera starting'}><span aria-hidden="true"/><span className="kiosk-camera-status-full">{cameraError?'Unavailable':videoReady?'Camera live':'Starting…'}</span><span className="kiosk-camera-status-short">{cameraError?'Error':videoReady?'Live':'Starting'}</span></span><button type="button" className="kiosk-stop" onClick={()=>{setManual(false);onStop();}}><X size={16} aria-hidden="true"/>Stop</button></div></div>
    {cameraError?<div className="kiosk-camera-error" role="alert"><AlertTriangle aria-hidden="true"/><h2>Camera unavailable</h2><p>{cameraError}. Allow camera access and try again. If it keeps happening, please see the librarian at the desk.</p><button type="button" onClick={()=>setRestartKey(current=>current+1)}>Try again</button></div>:<><div className="kiosk-camera-frame" aria-hidden="true"><i/><i/><i/><i/><span className="kiosk-scan-line"/></div>{!videoReady&&<div className="kiosk-camera-loading" role="status"><Loader2 className="animate-spin" aria-hidden="true"/>Starting camera…</div>}</>}
    <div className="kiosk-camera-caption"><button type="button" aria-label="Switch camera" onClick={()=>setFacing(current=>current==="environment"?"user":"environment")}><Camera size={20} aria-hidden="true"/></button><div><strong>Hold your ID’s QR code inside the frame</strong><span>Scanning for {attendanceType==="check_in"?'TIME IN':'TIME OUT'}</span></div><button type="button" aria-label="Enter ID manually" onClick={()=>{onStop();setManual(true);}}><Keyboard size={20} aria-hidden="true"/></button></div>
   </div>:manual?<div className="kiosk-manual-panel"><h2>Enter library ID</h2>{modeSwitch}</div>:<IdleView onStart={type=>{setManual(false);onStart(type);}} onManual={()=>setManual(true)} processing={processing}/>}
  <form onSubmit={submit} className={manual?"kiosk-manual-form":"kiosk-wedge-form"}>
    <label htmlFor="kiosk-scanned-id" className={manual?"":"sr-only"}>Scan library ID</label><input id="kiosk-scanned-id" name="scannedId" ref={inputRef} autoComplete="off" value={value} onChange={event=>setValue(event.target.value)} readOnly={processing||covered} tabIndex={manual?0:-1} className={manual?"":"kiosk-wedge-input"} placeholder="Library ID" onBlur={event=>{if(!processing&&!covered&&!interactive(event.relatedTarget))setTimeout(()=>{if(!interactive(document.activeElement))inputRef.current?.focus({preventScroll:true});},0);}}/>
    {manual&&<div className="kiosk-manual-actions"><button type="submit" disabled={processing||!value.trim()}>Record attendance</button><button type="button" onClick={()=>setManual(false)}>Cancel</button></div>}
  </form>
  {processing&&<div className="kiosk-processing" role="status"><Loader2 size={40} className="animate-spin" aria-hidden="true"/><span>Recording attendance…</span></div>}
 </div>;
}
