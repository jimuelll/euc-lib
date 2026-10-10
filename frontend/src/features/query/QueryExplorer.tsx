import RecordsWorkspace from './RecordsWorkspace';
export default function QueryExplorer({onUpdated,refreshToken}:{onUpdated?:(time:number)=>void;refreshToken?:number}){return <RecordsWorkspace onUpdated={onUpdated} refreshToken={refreshToken}/>;}
