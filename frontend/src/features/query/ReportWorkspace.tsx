import RecordsWorkspace from './RecordsWorkspace';
export default function ReportWorkspace({onUpdated,refreshToken}:{onUpdated?:(time:number)=>void;refreshToken?:number}){return <RecordsWorkspace report onUpdated={onUpdated} refreshToken={refreshToken}/>;}
