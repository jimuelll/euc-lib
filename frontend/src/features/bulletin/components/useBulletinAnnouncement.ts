import {useCallback,useEffect,useRef,useState} from 'react';
export function useBulletinAnnouncement(){
 const [message,setMessage]=useState('');
 const timer=useRef<ReturnType<typeof setTimeout>>();
 const announce=useCallback((value:string)=>{clearTimeout(timer.current);setMessage(value);if(value)timer.current=setTimeout(()=>setMessage(''),3000);},[]);
 useEffect(()=>()=>clearTimeout(timer.current),[]);
 return [message,announce] as const;
}
