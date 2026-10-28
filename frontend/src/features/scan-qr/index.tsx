import { useState, useCallback, useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import KioskHeader from "@/components/layout/KioskHeader";
import KioskFooter from "@/components/layout/KioskFooter";
import { getUserInitials } from "@/components/layout/navbar.utils";
import ScanningView from "./components/ScanningView";
import { SuccessView, NoticeView, ErrorView } from "./components/ResultView";
import type { ScanMode, AttendanceType, AttendanceResult, AttendanceNotice } from "./types";
import { postAttendanceScan, AttendanceScanError, AUTO_RESET_DELAY } from "./utils";
import { invalidateServerState } from "@/app/server-state";
import "./scanner-kiosk.css";
export { useZxingScanner } from "./hooks/useZxingScanner";

export const ATTENDANCE_MODE_KEY = "euc-kiosk-attendance-mode";
const initialType = ():AttendanceType => {try{return localStorage.getItem(ATTENDANCE_MODE_KEY)==="check_out"?"check_out":"check_in";}catch{return "check_in";}};
export const scanTime=(date:Date)=>date.toLocaleTimeString("en-US",{timeZone:"Asia/Manila",hour:"numeric",minute:"2-digit",hour12:true});

function ScannerStation() {
  const queryClient=useQueryClient();
  const {mutateAsync:submitScan}=useMutation({mutationFn:({scannedId,type}:{scannedId:string;type:AttendanceType})=>postAttendanceScan(scannedId,type),onSuccess:()=>invalidateServerState(queryClient,"attendance")});
  const [scanMode,setScanMode]=useState<ScanMode>("idle");
  const [attendanceType,setAttendanceType]=useState<AttendanceType>(initialType);
  const [cameraEnabled,setCameraEnabled]=useState(false);
  const [result,setResult]=useState<AttendanceResult|null>(null);
  const [notice,setNotice]=useState<AttendanceNotice|null>(null);
  const [errorMsg,setErrorMsg]=useState("");
  const [scannedValue,setScannedValue]=useState("");
  const [remaining,setRemaining]=useState(AUTO_RESET_DELAY/1000);
  const [now,setNow]=useState(()=>new Date());
  const [session,setSession]=useState<{recent:AttendanceResult[];timeIns:number;timeOuts:number}>({recent:[],timeIns:0,timeOuts:0});
  const processing=useRef(false),cameraRef=useRef(false),lastRead=useRef(Date.now()),epoch=useRef(0),alive=useRef(true);
  const clearResult=useCallback(()=>{setResult(null);setNotice(null);setErrorMsg("");setScannedValue("");},[]);
  const reset=useCallback(()=>{setScanMode(cameraRef.current?"scanning":"idle");clearResult();},[clearResult]);
  const stop=useCallback(()=>{epoch.current++;cameraRef.current=false;setCameraEnabled(false);setScanMode("idle");clearResult();},[clearResult]);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;epoch.current++;};},[]);
  useEffect(()=>{const timer=window.setInterval(()=>{setNow(new Date());if(cameraRef.current&&Date.now()-lastRead.current>=60000)stop();},1000);return()=>window.clearInterval(timer);},[stop]);
  useEffect(()=>{const hide=()=>{if(document.visibilityState==="hidden")stop();};document.addEventListener("visibilitychange",hide);return()=>document.removeEventListener("visibilitychange",hide);},[stop]);
  useEffect(()=>{
    if(!["success","notice","error"].includes(scanMode))return;
    const deadline=Date.now()+AUTO_RESET_DELAY;setRemaining(AUTO_RESET_DELAY/1000);
    const timer=window.setInterval(()=>{const left=Math.max(0,Math.ceil((deadline-Date.now())/1000));setRemaining(left);if(!left)reset();},100);
    return()=>window.clearInterval(timer);
  },[scanMode,reset]);
  const selectType=(type:AttendanceType)=>{lastRead.current=Date.now();setAttendanceType(type);try{localStorage.setItem(ATTENDANCE_MODE_KEY,type);}catch{/* The current mode still works when storage is unavailable. */}};
  const start=(type:AttendanceType)=>{if(processing.current)return;selectType(type);cameraRef.current=true;setCameraEnabled(true);setScanMode("scanning");};
  const handleScannedValue=useCallback(async(value:string)=>{
    const scannedId=value.trim();if(processing.current||!scannedId)return;
    const requestEpoch=epoch.current;lastRead.current=Date.now();processing.current=true;setScanMode("processing");setScannedValue(scannedId);setErrorMsg("");setNotice(null);
    try {
      const data=await submitScan({scannedId,type:attendanceType});
      if(!alive.current)return;
      const entry:AttendanceResult={type:data.type,userName:data.user.name,studentId:data.user.student_employee_id,timestamp:new Date()};
      setResult(entry);setSession(current=>({recent:[entry,...current.recent].slice(0,5),timeIns:current.timeIns+(data.type==="check_in"?1:0),timeOuts:current.timeOuts+(data.type==="check_out"?1:0)}));if(requestEpoch===epoch.current)setScanMode("success");
    } catch(error:unknown) {
      if(!alive.current||requestEpoch!==epoch.current)return;
      if(error instanceof AttendanceScanError && ["ALREADY_TIMED_IN","ALREADY_TIMED_OUT"].includes(error.code||"") && error.user && error.type){setNotice({type:error.type,userName:error.user.name,studentId:error.user.student_employee_id,message:error.message});setScanMode("notice");}
      else{setErrorMsg(error instanceof Error?error.message:"An unexpected error occurred");setScanMode("error");}
    } finally {processing.current=false;}
  },[attendanceType,submitScan]);
  const ready=scanMode==="idle"||scanMode==="scanning"||scanMode==="processing";
  return <div className="scanner-kiosk-shell">
    <KioskHeader station="scanner" />
    <div data-library-design className="scanner-kiosk">
    <main className="kiosk-scanner-main">
      <div className="kiosk-title-row"><div className="kiosk-title-block"><p className="kiosk-eyebrow"><span aria-hidden="true" />Library attendance</p><h1>Attendance <em>Scanner</em></h1></div><time className="kiosk-clock" dateTime={now.toISOString()} aria-live="off"><strong>{now.toLocaleTimeString("en-US",{timeZone:"Asia/Manila",hour:"numeric",minute:"2-digit",second:"2-digit",hour12:true})}</strong><span>{now.toLocaleDateString("en-US",{timeZone:"Asia/Manila",weekday:"short",month:"short",day:"numeric"})}</span></time></div>
      <div className="kiosk-workspace">
        <section className={`kiosk-scan-card kiosk-scan-card--${scanMode}`} aria-label="Attendance scanner">
          <ScanningView attendanceType={attendanceType} onSelect={selectType} onStart={start} onStop={stop} onScanned={handleScannedValue} scanMode={scanMode} cameraEnabled={cameraEnabled}/>
          {!ready&&<div className="kiosk-result-region" aria-live="assertive" aria-atomic="true" data-scan-state={scanMode}>
            {scanMode==="success"&&result&&<SuccessView result={result} remaining={remaining} cameraActive={cameraEnabled}/>}
            {scanMode==="notice"&&notice&&<NoticeView notice={notice} remaining={remaining} cameraActive={cameraEnabled}/>}
            {scanMode==="error"&&<ErrorView errorMsg={errorMsg} scannedValue={scannedValue} remaining={remaining} cameraActive={cameraEnabled}/>}
          </div>}
        </section>
        <aside className="kiosk-recent-card" aria-label="Recent scans in this session"><div className="kiosk-panel-header"><span>Recent scans</span><small>Last 5</small></div>
          {session.recent.length?<ol className="kiosk-recent-list">{session.recent.map((entry,index)=><li key={`${entry.timestamp.getTime()}-${index}`} className={index===0?"is-latest":""}><span className="kiosk-recent-avatar" aria-hidden="true">{getUserInitials(entry.userName)}</span><div className="kiosk-recent-person"><strong title={entry.userName}>{entry.userName}</strong><span>{entry.studentId}</span></div><div className="kiosk-recent-status"><span className={`kiosk-scan-badge ${entry.type==="check_in"?"is-in":"is-out"}`}>{entry.type==="check_in"?"IN":"OUT"}</span><time dateTime={entry.timestamp.toISOString()}>{scanTime(entry.timestamp)}</time></div></li>)}</ol>:<div className="kiosk-recent-empty"><h2>No scans yet</h2><p>Successful scans from this kiosk session will appear here.</p></div>}
          <p className="kiosk-session-note">This kiosk session only</p>
        </aside>
      </div>
    </main>
    <KioskFooter counts={session}/>
    </div>
  </div>;
}
export default function ScanQR(){const {user}=useAuth();return <ScannerStation key={user?.id}/>;}
