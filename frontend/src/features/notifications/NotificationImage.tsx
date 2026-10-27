import {useState} from 'react';
export function NotificationImage({url,alt}:{url?:string|null;alt?:string|null}) {
 const [failed,setFailed]=useState(false);
 if(!url)return null;
 return <figure className="notification-image">{failed?<p role="status">The image could not be loaded. {alt}</p>:<img src={url} alt={alt?.trim() || 'Notification image'} onError={()=>setFailed(true)}/>}<figcaption><span>{alt}</span><a href={url} target="_blank" rel="noopener noreferrer">View full image<span className="sr-only"> (opens in a new tab)</span></a></figcaption></figure>;
}
