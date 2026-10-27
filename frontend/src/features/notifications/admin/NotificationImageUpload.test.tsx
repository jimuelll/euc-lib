// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import NotificationImageUpload from './NotificationImageUpload';
import * as api from './api';
import * as compression from './compressNotificationImage';
vi.mock('./compressNotificationImage',()=>({MAX_NOTIFICATION_IMAGE_BYTES:5*1024*1024,compressNotificationImage:vi.fn()}));
vi.mock('./api',()=>({uploadNotificationImage:vi.fn()}));
const change=vi.fn(),alt=vi.fn(),busy=vi.fn(),blocked=vi.fn();
function mount(url=''){return render(<NotificationImageUpload url={url} alt="Hours" onChange={change} onAltChange={alt} onBusy={busy} onBlocked={blocked}/>);}
const file=()=>new File(['image'],'poster.png',{type:'image/png'});
beforeEach(()=>{vi.resetAllMocks();vi.mocked(api.uploadNotificationImage).mockResolvedValue({imageUrl:'https://example.edu/poster.jpg',imagePublicId:'library/notifications/test'});vi.mocked(compression.compressNotificationImage).mockResolvedValue(new File(['compressed'],'poster.jpg',{type:'image/jpeg'}));});afterEach(cleanup);
it('uploads a single image with progress, then records its reference',async()=>{mount();fireEvent.change(screen.getByLabelText('Upload notification image'),{target:{files:[file()]}});await waitFor(()=>expect(change).toHaveBeenCalledWith('https://example.edu/poster.jpg','library/notifications/test'));expect(busy).toHaveBeenCalledWith(true);expect(busy).toHaveBeenLastCalledWith(false);});
it('rejects unsupported files before making an upload request',()=>{mount();fireEvent.change(screen.getByLabelText('Upload notification image'),{target:{files:[new File(['bad'],'x.svg',{type:'image/svg+xml'})]}});expect(api.uploadNotificationImage).not.toHaveBeenCalled();expect(blocked).toHaveBeenCalledWith(true);expect(screen.getByRole('alert')).toBeTruthy();});
it('blocks failed uploads until retry or removal and retains the chosen file for retry',async()=>{vi.mocked(api.uploadNotificationImage).mockRejectedValueOnce(new Error('Offline'));mount();fireEvent.change(screen.getByLabelText('Upload notification image'),{target:{files:[file()]}});fireEvent.click(await screen.findByRole('button',{name:'Retry image upload'}));await waitFor(()=>expect(change).toHaveBeenCalled());expect(api.uploadNotificationImage).toHaveBeenCalledTimes(2);});
it('allows an optional description and removes references without deleting remote assets',()=>{mount('https://example.edu/poster.jpg');expect((screen.getByLabelText(/Image description/) as HTMLInputElement).required).toBe(false);fireEvent.click(screen.getByRole('button',{name:'Remove image'}));expect(change).toHaveBeenCalledWith('','');expect(alt).toHaveBeenCalledWith('');});

it('accepts a dropped image and retains its filename and size after upload',async()=>{
 mount();fireEvent.drop(screen.getByRole('button',{name:/Drop an image/}),{dataTransfer:{files:[file()]}});
 await waitFor(()=>expect(change).toHaveBeenCalled());expect(screen.getByText('poster.png')).toBeTruthy();expect(screen.getByText(/KB/)).toBeTruthy();
});
it('compresses oversized images and waits for review before uploading',async()=>{
 mount();const large=new File([new Uint8Array(5*1024*1024+1)],'large.png',{type:'image/png'});
 fireEvent.change(screen.getByLabelText('Upload notification image'),{target:{files:[large]}});
 expect(await screen.findByText(/Compressed to/)).toBeTruthy();expect(compression.compressNotificationImage).toHaveBeenCalledWith(large,expect.any(AbortSignal));expect(api.uploadNotificationImage).not.toHaveBeenCalled();expect(blocked).toHaveBeenLastCalledWith(true);
 fireEvent.click(screen.getByRole('button',{name:'Upload compressed image'}));await waitFor(()=>expect(change).toHaveBeenCalled());expect(vi.mocked(api.uploadNotificationImage).mock.calls[0][0].type).toBe('image/jpeg');expect(blocked).toHaveBeenLastCalledWith(false);
});
it('rejects multiple dropped images without uploading',()=>{mount();fireEvent.drop(screen.getByRole('button',{name:/Drop an image/}),{dataTransfer:{files:[file(),file()]}});expect(screen.getByRole('alert').textContent).toContain('one image');expect(api.uploadNotificationImage).not.toHaveBeenCalled();});
it('reports compression failures and allows retry or removal',async()=>{vi.mocked(compression.compressNotificationImage).mockRejectedValueOnce(new Error('Could not read this image.'));mount();fireEvent.change(screen.getByLabelText('Upload notification image'),{target:{files:[new File([new Uint8Array(5*1024*1024+1)],'large.png',{type:'image/png'})]}});expect((await screen.findByRole('alert')).textContent).toContain('Could not read');expect(blocked).toHaveBeenLastCalledWith(true);fireEvent.click(screen.getByRole('button',{name:'Retry image upload'}));expect(await screen.findByText(/Compressed to/)).toBeTruthy();fireEvent.click(screen.getByRole('button',{name:'Remove image'}));expect(blocked).toHaveBeenLastCalledWith(false);});
it('ignores compression results after cancellation',async()=>{let finish!:(file:File)=>void;vi.mocked(compression.compressNotificationImage).mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));mount();fireEvent.change(screen.getByLabelText('Upload notification image'),{target:{files:[new File([new Uint8Array(5*1024*1024+1)],'large.png',{type:'image/png'})]}});fireEvent.click(screen.getByRole('button',{name:'Cancel image upload'}));finish(new File(['compressed'],'large.jpg',{type:'image/jpeg'}));await waitFor(()=>expect(busy).toHaveBeenLastCalledWith(false));expect(screen.queryByText(/Compressed to/)).toBeNull();expect(api.uploadNotificationImage).not.toHaveBeenCalled();});
it('cancels an upload and ignores a late response',async()=>{
 let resolveUpload!:(value:{imageUrl:string;imagePublicId:string})=>void;
 vi.mocked(api.uploadNotificationImage).mockImplementation(()=>new Promise(resolve=>{resolveUpload=resolve;}));
 mount();fireEvent.change(screen.getByLabelText('Upload notification image'),{target:{files:[file()]}});
 fireEvent.click(screen.getByRole('button',{name:'Cancel image upload'}));expect(api.uploadNotificationImage).toHaveBeenCalled();
 resolveUpload({imageUrl:'https://example.edu/late.jpg',imagePublicId:'late'});
 await waitFor(()=>expect(busy).toHaveBeenLastCalledWith(false));expect(change).not.toHaveBeenCalledWith('https://example.edu/late.jpg','late');expect(blocked).toHaveBeenLastCalledWith(false);
});
