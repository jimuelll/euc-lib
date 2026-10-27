// @vitest-environment jsdom
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {compressNotificationImage,MAX_NOTIFICATION_IMAGE_BYTES} from './compressNotificationImage';

const originalCreate=URL.createObjectURL,originalRevoke=URL.revokeObjectURL;
const fillRect=vi.fn(),drawImage=vi.fn();
class TestImage {
  naturalWidth=2400;naturalHeight=1200;onload:(()=>void)|null=null;onerror:(()=>void)|null=null;
  set src(value:string){if(value)queueMicrotask(()=>this.onload?.());}
}
beforeEach(()=>{
  vi.stubGlobal('Image',TestImage);
  URL.createObjectURL=vi.fn(()=>'blob:original');URL.revokeObjectURL=vi.fn();
  vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue({fillRect,drawImage} as unknown as CanvasRenderingContext2D);
});
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();URL.createObjectURL=originalCreate;URL.revokeObjectURL=originalRevoke;fillRect.mockReset();drawImage.mockReset();});
it('resizes and retries until the compressed JPEG fits the upload limit',async()=>{
  let attempts=0;
  const encode=vi.spyOn(HTMLCanvasElement.prototype,'toBlob').mockImplementation(function(callback,type,quality){
    expect(type).toBe('image/jpeg');expect(quality).toBeGreaterThanOrEqual(0.7);
    callback(new Blob([new Uint8Array(attempts++===0?MAX_NOTIFICATION_IMAGE_BYTES+1:1024)],{type:'image/jpeg'}));
  });
  const output=await compressNotificationImage(new File(['input'],'poster.png',{type:'image/png'}),new AbortController().signal);
  expect(output.name).toBe('poster.jpg');expect(output.type).toBe('image/jpeg');expect(output.size).toBeLessThanOrEqual(MAX_NOTIFICATION_IMAGE_BYTES);
  expect(encode).toHaveBeenCalledTimes(2);expect(drawImage).toHaveBeenCalledTimes(2);expect(drawImage.mock.calls[0][3]).toBe(1600);expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:original');
});
it('reports a useful error when the browser cannot encode an image',async()=>{
  vi.spyOn(HTMLCanvasElement.prototype,'toBlob').mockImplementation(callback=>callback(null));
  await expect(compressNotificationImage(new File(['input'],'poster.png',{type:'image/png'}),new AbortController().signal)).rejects.toThrow(/could not compress/);
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:original');
});
it('stops processing when cancelled and releases the image URL',async()=>{
  const controller=new AbortController();
  vi.spyOn(HTMLCanvasElement.prototype,'toBlob').mockImplementation(callback=>{controller.abort();callback(new Blob(['image'],{type:'image/jpeg'}));});
  await expect(compressNotificationImage(new File(['input'],'poster.png',{type:'image/png'}),controller.signal)).rejects.toMatchObject({name:'AbortError'});
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:original');
});
