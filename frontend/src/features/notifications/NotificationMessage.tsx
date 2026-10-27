import {NotificationImage} from './NotificationImage';
import './notification-reader.css';

/** The complete message and media shown in the patron reader and compose preview. */
export default function NotificationMessage({body,imageUrl,imageAlt}:{body:string;imageUrl?:string|null;imageAlt?:string|null}) {
  return <><p className="notification-reader-message">{body}</p><NotificationImage key={imageUrl} url={imageUrl} alt={imageAlt}/></>;
}
