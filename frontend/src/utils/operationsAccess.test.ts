import {expect,it} from "vitest";
import {operationsHome,operationsPasswordError} from "./operationsAccess";
import {validateUserForm} from "@/features/admin/manage/userForm";
import {EMPTY_FORM,getAllowedRoles} from "@/features/admin/manage/AdminManage.data";
it('requires a single concrete operations type, username and matching valid passwords',()=>{
 expect(validateUserForm({...EMPTY_FORM,role:'library_operations'},true).role).toBeTruthy();
 for (const role of ['scanner','opac']) {
  const form={...EMPTY_FORM,role,fullName:'Terminal',username:'desk',password:'terminal-password',rePassword:'terminal-password'};
  expect(validateUserForm(form,true)).toEqual({});
  expect(validateUserForm({...form,rePassword:'different'},true).rePassword).toBeTruthy();
  expect(validateUserForm({...form,password:'short'},true).password).toBeTruthy();
  expect(validateUserForm({...form,password:'',rePassword:''},false)).toEqual({});
 }
 expect(operationsPasswordError('😀'.repeat(19))).toBeTruthy();
});
it('resolves terminal homes and restricts management roles',()=>{
 expect(operationsHome('scanner')).toBe('/scan-qr');expect(operationsHome('opac')).toBe('/catalogue');expect(operationsHome('student')).toBeNull();
 expect(getAllowedRoles('staff')).not.toContain('scanner');expect(getAllowedRoles('staff')).not.toContain('opac');
 for(const role of ['admin','super_admin'])expect(getAllowedRoles(role)).toEqual(expect.arrayContaining(['scanner','opac']));
});
