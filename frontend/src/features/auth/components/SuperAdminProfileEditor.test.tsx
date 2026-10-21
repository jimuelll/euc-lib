// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {afterEach,it,expect,vi} from 'vitest';
import * as api from '../profile.api';
import SuperAdminProfileEditor from './SuperAdminProfileEditor';
vi.mock('../profile.api',()=>({getProfile:vi.fn(),saveProfile:vi.fn()}));
afterEach(()=>{cleanup();vi.resetAllMocks();});
const profile={name:'Admin',username:'admin',address:'Campus',contact:'09123456789'};
function mount(){render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><SuperAdminProfileEditor/></QueryClientProvider>);}
it('loads existing details and saves only editable profile fields',async()=>{
 vi.mocked(api.getProfile).mockResolvedValue(profile);vi.mocked(api.saveProfile).mockResolvedValue({...profile,name:'Updated Admin'});mount();
 fireEvent.change(await screen.findByLabelText('Full name'),{target:{value:'Updated Admin'}});
 fireEvent.click(screen.getByRole('button',{name:'Save account details'}));
 await screen.findByRole('status');
 await waitFor(()=>expect(api.saveProfile).toHaveBeenCalledWith({...profile,name:'Updated Admin'}));
 expect(await screen.findByText('Account details saved.')).toBeTruthy();
});
it('retains edits and displays server validation failures',async()=>{
 vi.mocked(api.getProfile).mockResolvedValue(profile);vi.mocked(api.saveProfile).mockRejectedValue({response:{data:{message:'That username is already in use'}}});mount();
 fireEvent.change(await screen.findByLabelText('Login username'),{target:{value:'duplicate'}});fireEvent.click(screen.getByRole('button',{name:'Save account details'}));
 expect((await screen.findByRole('alert')).textContent).toBe('That username is already in use');
 expect((screen.getByLabelText('Login username') as HTMLInputElement).value).toBe('duplicate');
});
