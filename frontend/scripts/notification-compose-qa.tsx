import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {BrowserRouter} from 'react-router-dom';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {ThemeProvider} from '../src/hooks/use-theme';
import {LibraryDesignProvider} from '../src/components/ui/library-design';
import {Button} from '../src/components/ui/button';
import NotificationComposeDrawer from '../src/features/notifications/admin/NotificationComposeDrawer';
import '../src/index.css';
import '../src/components/ui/library-design.css';
import '../src/components/ui/library-workspaces.css';
import '../src/features/admin/compact-admin.css';
import '../src/features/notifications/admin/notifications.css';
function App(){const[open,setOpen]=useState(false);return <LibraryDesignProvider><main data-library-design style={{minHeight:'100dvh',padding:24}}><h1>Library notifications</h1><Button onClick={()=>setOpen(true)}>New notification</Button>{open&&<NotificationComposeDrawer initial={null} onClose={()=>setOpen(false)} onSent={async()=>{}}/>}</main></LibraryDesignProvider>;}
createRoot(document.getElementById('root')!).render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><ThemeProvider><BrowserRouter><App/></BrowserRouter></ThemeProvider></QueryClientProvider>);
