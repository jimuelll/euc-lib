import {useState,useEffect} from 'react';
import {Navigate} from 'react-router-dom';
import {useQuery} from '@tanstack/react-query';
import {useAdminUrlState} from '@/features/admin';
import {useAuth} from '@/context/AuthContext';
import {Button} from '@/components/ui/button';
import {getApiErrorMessage} from '@/utils/apiError';
import {catalogKeys} from '../catalog.keys';
import {fetchCatalogSchema} from './catalog.api';
import type {FormField} from './AdminCatalog.types';
import AdminCatalogData from './AdminCatalogData';
import AdminCatalogBuilder from './AdminCatalogBuilder';
import AdminAIRecommendations from './AdminAIRecommendations';
const settingsRoutes={builder:'/admin/settings/catalog-fields',ai:'/admin/settings/ai'} as const;
export default function AdminCatalog({mode='catalog'}:{mode?:'catalog'|'builder'|'ai'}){
 const {user}=useAuth(),[params]=useAdminUrlState(),requested=params.get('tab');
 const [fields,setFields]=useState<FormField[]>([]);
 const schema=useQuery({queryKey:catalogKeys.adminSchema(),queryFn:({signal})=>fetchCatalogSchema(signal),enabled:mode!=='ai'});
 useEffect(()=>{if(schema.data&&fields.length===0)setFields(schema.data);},[schema.data,fields.length]);
 // Catalog fields and AI recommendations used to be ?tab= views of this page.
 if(mode==='catalog'&&user?.role==='super_admin'&&(requested==='builder'||requested==='ai')){const rest=new URLSearchParams(params);rest.delete('tab');return <Navigate to={{pathname:settingsRoutes[requested],search:rest.size?`?${rest}`:''}} replace/>;}
 if(mode==='ai')return <AdminAIRecommendations/>;
 if(schema.isPending)return <p role="status" className="mt-6 text-sm text-muted-foreground">Loading catalog fields…</p>;
 if(schema.isError)return <div role="alert" className="mt-6 flex items-center gap-3 text-sm text-destructive">{getApiErrorMessage(schema.error,'Could not load catalog fields')}<Button variant="outline" onClick={()=>void schema.refetch()}>Try again</Button></div>;
 if(mode==='builder')return <AdminCatalogBuilder fields={fields} onFieldsChange={setFields}/>;
 return <AdminCatalogData fields={fields} isSuperAdmin={user?.role==='super_admin'}/>;
}
