// @vitest-environment jsdom
import { cleanup,fireEvent,render,screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach,describe,expect,it,vi } from 'vitest';
import { NotificationEmailOptions,NotificationEmailResults } from './NotificationEmailOptions';
const preview={inAppCount:30,emailCount:28,skippedCount:2,enabled:true,reason:null,dailyLimit:300,securityReserve:50,usedToday:180,queuedRoutine:60,remainingRoutine:10,resetAt:'2026-10-28T00:00:00Z'};
const props={checked:true,onChange:vi.fn(),preview,loading:false,error:false,onRetry:vi.fn(),scheduled:false};
afterEach(cleanup);
describe('manual notification email controls',()=>{
 it('defaults to in-app only and exposes an accessible opt-in',()=>{const onChange=vi.fn();render(<NotificationEmailOptions {...props} checked={false} onChange={onChange}/>);expect(screen.getByRole('checkbox',{name:'Also send by email'})).not.toBeChecked();expect(screen.queryByText(/This will email/)).not.toBeInTheDocument();fireEvent.click(screen.getByRole('checkbox'));expect(onChange).toHaveBeenCalledWith(true);});
 it('shows eligible counts, skipped users, reserve and multi-day expiry clearly',()=>{render(<NotificationEmailOptions {...props}/>);expect(screen.getByText('This will email 28 users.')).toBeInTheDocument();expect(screen.getByText(/2 skipped for email/)).toBeInTheDocument();expect(screen.getByText(/10 estimated email slots/)).toBeInTheDocument();expect(screen.getByText(/50 of 300 daily slots/)).toBeInTheDocument();expect(screen.getByText(/seven days/)).toBeInTheDocument();});
 it('distinguishes scheduled estimates and audience resolution',()=>{render(<NotificationEmailOptions {...props} scheduled/>);expect(screen.getByText(/Estimated email audience: 28/)).toBeInTheDocument();expect(screen.getByText(/determined at scheduled publication/)).toBeInTheDocument();});
 it('handles loading, unavailable preview and paused sending without trapping opt-out',()=>{const {rerender}=render(<NotificationEmailOptions {...props} loading/>);expect(screen.getByRole('status')).toHaveTextContent('Checking email');rerender(<NotificationEmailOptions {...props} error/>);fireEvent.click(screen.getByRole('button',{name:'Try again'}));expect(props.onRetry).toHaveBeenCalled();rerender(<NotificationEmailOptions {...props} preview={{...preview,enabled:false,reason:'Email delivery is paused.'}}/>);expect(screen.getByRole('alert')).toHaveTextContent('Uncheck email');expect(screen.getByRole('checkbox')).toBeEnabled();});
 it('explains zero verified recipients',()=>{render(<NotificationEmailOptions {...props} preview={{...preview,emailCount:0}}/>);expect(screen.getByRole('alert')).toHaveTextContent('No verified email recipients');});
 it('separates every email status from inbox delivery',()=>{render(<NotificationEmailResults summary={{queued:20,processing:1,accepted:6,failed:1,unknown:0,cancelled:0}}/>);for(const label of ['Queued','Processing','Accepted by provider','Failed','Unknown','Cancelled'])expect(screen.getByText(label)).toBeInTheDocument();expect(screen.getByText(/does not confirm inbox delivery/)).toBeInTheDocument();});
});
