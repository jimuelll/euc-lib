import {expect,it} from 'vitest';
import {EMPTY_FORM} from './AdminManage.data';
import {requiredUserFields,suggestUsername,validateUserForm} from './userForm';
it('requires only fields belonging to the selected role',()=>{
  expect(requiredUserFields({...EMPTY_FORM,role:'student'},true)).toEqual(expect.arrayContaining(['libraryCardNumber','studentNumber','academicTermId','yearLevel','programId']));
  expect(requiredUserFields({...EMPTY_FORM,role:'staff'},true)).not.toContain('programId');
  expect(requiredUserFields({...EMPTY_FORM,role:'employee'},true)).toContain('departmentId');
  expect(requiredUserFields({...EMPTY_FORM,role:'alumni'},true)).not.toContain('studentNumber');
});
it('ignores irrelevant stale fields and validates supplied email on edits',()=>{
  const form={...EMPTY_FORM,role:'staff',fullName:'Desk Staff',username:'desk',email:'desk@example.edu',studentNumber:'',programId:''};
  expect(validateUserForm(form,true)).toEqual({});
  expect(validateUserForm({...form,email:'invalid'},false).email).toBeTruthy();
});
it('suggests a readable username from names with accents',()=>{
  expect(suggestUsername('  José Rivera  ')).toBe('jose.rivera');
});
