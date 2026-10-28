// @vitest-environment jsdom
import {act,cleanup,renderHook} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {useZxingScanner} from './useZxingScanner';
const reader=vi.hoisted(()=>({reset:vi.fn(),decodeFromConstraints:vi.fn(),decodeFromVideoDevice:vi.fn()}));
vi.mock('@zxing/library',()=>({BrowserMultiFormatReader:class {constructor(){return reader;}},NotFoundException:class extends Error{},ChecksumException:class extends Error{},FormatException:class extends Error{}}));
afterEach(()=>{cleanup();vi.clearAllMocks();});
it('emits one result, stops the reader and ignores results after close',()=>{
 reader.decodeFromConstraints.mockResolvedValue(undefined);const onResult=vi.fn();
 const hook=renderHook(()=>useZxingScanner({active:true,facingMode:'environment',onResult}));
 const decode=reader.decodeFromConstraints.mock.calls[0][2];
 expect(reader.decodeFromConstraints.mock.calls[0][0]).toEqual({video:{facingMode:{ideal:'environment'}}});
 act(()=>{decode({getText:()=> 'ACC-1'});decode({getText:()=> 'ACC-1'});});
 expect(onResult).toHaveBeenCalledExactlyOnceWith('ACC-1');expect(reader.reset).toHaveBeenCalled();
 hook.unmount();decode({getText:()=> 'ACC-2'});expect(onResult).toHaveBeenCalledTimes(1);
});
it('releases a camera that finishes opening after the scanner closes',async()=>{
 let resolve!:()=>void;reader.decodeFromConstraints.mockImplementation(()=>new Promise<void>(done=>{resolve=done;}));
 const hook=renderHook(()=>useZxingScanner({active:true,facingMode:'environment',onResult:vi.fn()}));hook.unmount();const count=reader.reset.mock.calls.length;
 await act(async()=>resolve());expect(reader.reset.mock.calls.length).toBeGreaterThan(count);
});

it('keeps the stream for kiosk queues while pausing repeated reads between results',()=>{
 reader.decodeFromConstraints.mockResolvedValue(undefined);const onResult=vi.fn();
 const hook=renderHook(({paused})=>useZxingScanner({active:true,continuous:true,paused,facingMode:'environment',onResult}),{initialProps:{paused:false}});
 const decode=reader.decodeFromConstraints.mock.calls[0][2];
 act(()=>{decode({getText:()=> 'ID-1'});decode({getText:()=> 'ID-1'});});expect(onResult).toHaveBeenCalledTimes(1);expect(reader.reset).not.toHaveBeenCalled();
 hook.rerender({paused:true});decode({getText:()=> 'ID-2'});expect(onResult).toHaveBeenCalledTimes(1);
 hook.rerender({paused:false});act(()=>decode({getText:()=> 'ID-2'}));expect(onResult).toHaveBeenCalledTimes(2);expect(reader.decodeFromConstraints).toHaveBeenCalledTimes(1);
 hook.unmount();expect(reader.reset).toHaveBeenCalled();
});
