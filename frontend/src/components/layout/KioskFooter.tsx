import "./kiosk-layout.css";
export default function KioskFooter({counts}:{counts?:{timeIns:number;timeOuts:number}}) {
  return <footer className="kiosk-footer">{counts?<div className="kiosk-footer-counters" aria-label="Attendance totals for this kiosk session">
    <div><strong>{counts.timeIns.toLocaleString()}</strong><span>Time-ins this session</span></div>
    <div><strong>{counts.timeOuts.toLocaleString()}</strong><span>Time-outs this session</span></div>
    <div><strong>{(counts.timeIns-counts.timeOuts).toLocaleString()}</strong><span>Net entries this session</span></div>
  </div>:<p className="kiosk-footer-credit">EUC Library · Enverga-Candelaria Library</p>}</footer>;
}
