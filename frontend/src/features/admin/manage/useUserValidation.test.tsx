// @vitest-environment jsdom
import {act,cleanup,renderHook,waitFor} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {EMPTY_FORM} from './AdminManage.data';
import {useUserValidation} from './useUserValidation';
import {checkUserAvailability} from './api';
vi.mock('./api',()=>({checkUserAvailability:vi.fn()}));
afterEach(()=>{cleanup();vi.resetAllMocks();});
it('ignores responses for values replaced while a check was pending',async()=>{
 let resolveOld:(value:{available:boolean})=>void;
 vi.mocked(checkUserAvailability).mockImplementation(async(field,value)=>field==='email'&&value==='old@example.edu'?new Promise(resolve=>{resolveOld=resolve;}):{available:true});
 const form={...EMPTY_FORM,role:'scanner',fullName:'Desk',username:'desk',email:'old@example.edu'};
 const {result,rerender}=renderHook(({email})=>useUserValidation({...form,email},true,true),{initialProps:{email:form.email}});
 await waitFor(()=>expect(checkUserAvailability).toHaveBeenCalledWith('email','old@example.edu',undefined,expect.any(AbortSignal)));
 rerender({email:'new@example.edu'});
 await waitFor(()=>expect(result.current.valid).toBe(true));
 await act(async()=>resolveOld({available:false}));
 expect(result.current.errors.email).toBeUndefined();
});
it('blocks submission and shows a retryable error when availability fails',async()=>{
 vi.mocked(checkUserAvailability).mockRejectedValue(new Error('Offline'));
 const {result}=renderHook(()=>useUserValidation({...EMPTY_FORM,role:'scanner',fullName:'Desk',username:'desk',email:'desk@example.edu'},true,true));
 await waitFor(()=>expect(result.current.errors.email).toContain('Could not check'));
 expect(result.current.valid).toBe(false);
});
it('retains server conflicts until that field or its role changes',async()=>{
 vi.mocked(checkUserAvailability).mockResolvedValue({available:true});
 const form={...EMPTY_FORM,role:'scanner',fullName:'Desk',username:'desk',email:'desk@example.edu'};
 const {result,rerender}=renderHook(({name,email})=>useUserValidation({...form,fullName:name,email},true,true),{initialProps:{name:'Desk',email:form.email}});
 await waitFor(()=>expect(result.current.valid).toBe(true));
 act(()=>result.current.setServerErrors({email:'This email already belongs to another user.'}));
 rerender({name:'Updated Desk',email:form.email});
 expect(result.current.errors.email).toContain('already belongs');
 rerender({name:'Updated Desk',email:'corrected@example.edu'});
 await waitFor(()=>expect(result.current.valid).toBe(true));
});
