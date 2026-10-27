// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import NotificationImageUpload from './NotificationImageUpload';
import * as api from './api';
vi.mock('./api',()=>({uploadNotificationImage:vi.fn()}));
const change=vi.fn(),alt=vi.fn(),busy=vi.fn(),blocked=vi.fn();
function mount(url=''){return render(<NotificationImageUpload url={url} alt="Hours" onChange={change} onAltChange={alt} onBusy={busy} onBlocked={blocked}/>);}
const file=()=>new File(['image'],'poster.png',{type:'image/png'});
beforeEach(()=>{vi.resetAllMocks();vi.mocked(api.uploadNotificationImage).mockResolvedValue({imageUrl:'https://example.edu/poster.jpg',imagePublicId:'library/notifications/test'});});afterEach(cleanup);
it('uploads a single image with progress, then records its reference',async()=>{mount();fireEvent.change(screen.getByLabelText('Upload notification image'),{target:{files:[file()]}});await waitFor(()=>expect(change).toHaveBeenCalledWith('https://example.edu/poster.jpg','library/notifications/test'));expect(busy).toHaveBeenCalledWith(true);expect(busy).toHaveBeenLastCalledWith(false);});
it('rejects unsupported files before making an upload request',()=>{mount();fireEvent.change(screen.getByLabelText('Upload notification image'),{target:{files:[new File(['bad'],'x.svg',{type:'image/svg+xml'})]}});expect(api.uploadNotificationImage).not.toHaveBeenCalled();expect(blocked).toHaveBeenCalledWith(true);expect(screen.getByRole('alert')).toBeTruthy();});
it('blocks failed uploads until retry or removal and retains the chosen file for retry',async()=>{vi.mocked(api.uploadNotificationImage).mockRejectedValueOnce(new Error('Offline'));mount();fireEvent.change(screen.getByLabelText('Upload notification image'),{target:{files:[file()]}});fireEvent.click(await screen.findByRole('button',{name:'Retry image upload'}));await waitFor(()=>expect(change).toHaveBeenCalled());expect(api.uploadNotificationImage).toHaveBeenCalledTimes(2);});
it('requires descriptive alt text and removes references without deleting remote assets',()=>{mount('https://example.edu/poster.jpg');expect((screen.getByLabelText(/Image description/) as HTMLInputElement).required).toBe(true);fireEvent.click(screen.getByRole('button',{name:'Remove image'}));expect(change).toHaveBeenCalledWith('','');expect(alt).toHaveBeenCalledWith('');});

it('accepts a dropped image and retains its filename and size after upload',async()=>{
 mount();fireEvent.drop(screen.getByRole('button',{name:/Drop an image/}),{dataTransfer:{files:[file()]}});
 await waitFor(()=>expect(change).toHaveBeenCalled());expect(screen.getByText('poster.png')).toBeTruthy();expect(screen.getByText(/KB/)).toBeTruthy();
});
it('rejects oversized and multiple images without uploading',()=>{
 mount();fireEvent.drop(screen.getByRole('button',{name:/Drop an image/}),{dataTransfer:{files:[file(),file()]}});expect(screen.getByRole('alert').textContent).toContain('one image');
 fireEvent.change(screen.getByLabelText('Upload notification image'),{target:{files:[new File([new Uint8Array(5*1024*1024+1)],'large.png',{type:'image/png'})]}});
 expect(screen.getByRole('alert').textContent).toContain('5 MB');expect(api.uploadNotificationImage).not.toHaveBeenCalled();
});
it('cancels an upload and ignores a late response',async()=>{
 let resolveUpload!:(value:{imageUrl:string;imagePublicId:string})=>void;
 vi.mocked(api.uploadNotificationImage).mockImplementation(()=>new Promise(resolve=>{resolveUpload=resolve;}));
 mount();fireEvent.change(screen.getByLabelText('Upload notification image'),{target:{files:[file()]}});
 fireEvent.click(screen.getByRole('button',{name:'Cancel image upload'}));expect(api.uploadNotificationImage).toHaveBeenCalled();
 resolveUpload({imageUrl:'https://example.edu/late.jpg',imagePublicId:'late'});
 await waitFor(()=>expect(busy).toHaveBeenLastCalledWith(false));expect(change).not.toHaveBeenCalledWith('https://example.edu/late.jpg','late');expect(blocked).toHaveBeenLastCalledWith(false);
});
