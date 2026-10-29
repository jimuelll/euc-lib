import {afterEach,expect,it,vi} from 'vitest';
import axios from '@/utils/AxiosInstance';
import {createUser,updateUser} from './api';
import {EMPTY_FORM} from './AdminManage.data';
vi.mock('@/utils/AxiosInstance',()=>({default:{post:vi.fn(),put:vi.fn()}}));
afterEach(()=>vi.resetAllMocks());
it('sends the same student profile for staff creation and edits',async()=>{
 const form={...EMPTY_FORM,role:'staff',fullName:'Student Staff',libraryCardNumber:'CARD-1',studentNumber:'ST-1',programId:'1',yearLevel:'2nd Year',academicTermId:'1',email:'staff@example.edu',username:'stale'};
 vi.mocked(axios.post).mockResolvedValue({data:{message:'Invited'}});vi.mocked(axios.put).mockResolvedValue({data:{message:'Saved'}});
 await createUser(form);await updateUser('CARD-1',form);
 const payload=vi.mocked(axios.post).mock.calls[0][1];
 expect(payload).toMatchObject({role:'staff',library_card_number:'CARD-1',student_number:'ST-1',program_id:'1',year_level:'2nd Year',academic_term_id:'1',email:'staff@example.edu'});
 expect(payload).not.toHaveProperty('username');expect(payload).not.toHaveProperty('password');
 expect(axios.put).toHaveBeenCalledWith('/api/admin/users/CARD-1',payload);
});
