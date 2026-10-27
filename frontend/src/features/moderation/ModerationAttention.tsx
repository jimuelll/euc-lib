import {useQuery} from '@tanstack/react-query';
import {Link} from 'react-router-dom';
import {useAuth} from '@/context/AuthContext';
import {fetchModerationStats} from './api';
import './moderation.css';
export function useModerationStats(){const {user}=useAuth();return useQuery({queryKey:['moderation-stats',user?.id],queryFn:({signal})=>fetchModerationStats(signal),enabled:['admin','super_admin'].includes(user?.role||''),refetchInterval:30000,retry:false});}
export function ModerationAttention(){const {user}=useAuth(),query=useModerationStats();if(!['admin','super_admin'].includes(user?.role||''))return null;
 if(query.isError)return <div className="moderation-attention" role="alert"><span>Moderation status unavailable.</span><Link to="/admin/moderation">Open moderation</Link><button onClick={()=>void query.refetch()}>Retry</button></div>;
 if(!query.data?.pending)return null;
 return <Link to="/admin/moderation" className="moderation-attention" data-urgent={query.data.urgent>0}><strong>{query.data.pending} {query.data.pending===1?'comment needs':'comments need'} review</strong><span>{query.data.urgent?`${query.data.urgent} priority ${query.data.urgent===1?'case':'cases'} · `:''}{query.data.oldest?`Oldest waiting since ${new Date(query.data.oldest).toLocaleString('en-PH',{dateStyle:'medium',timeStyle:'short'})}`:''}</span><span>Review comments →</span></Link>;
}
