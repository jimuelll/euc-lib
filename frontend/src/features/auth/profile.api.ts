import axios, {refreshAccessToken} from '@/utils/AxiosInstance';
export interface Profile {name:string;username:string;address:string;contact:string}
export const getProfile=async()=>(await axios.get<Profile>('/api/auth/profile')).data;
export const saveProfile=async(profile:Profile)=>{
 const result=(await axios.put<Profile>('/api/auth/profile',profile)).data;
 // Refresh the signed-in display name without making a saved edit look like a failure.
 try {await refreshAccessToken();}catch { /* The next session refresh will load the saved name. */ }
 return result;
};
