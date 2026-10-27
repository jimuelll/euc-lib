import type { UserFormState } from './AdminManage.types';

export type UserFieldErrors = Partial<Record<keyof UserFormState, string>>;
export const borrowingRoles = ['student', 'employee', 'alumni'];
export const roleDescriptions: Record<string, string> = {
  student: 'Can borrow and reserve during an assigned academic term.',
  alumni: 'Can borrow and reserve as an alumni patron.',
  employee: 'Can borrow and reserve as an employee patron.',
  scanner: 'Can scan library attendance only.',
  staff: 'Can manage daily library operations and patron accounts.',
  admin: 'Can manage library operations, staff and settings.',
  super_admin: 'Can manage all library settings and administrator accounts.',
};
export function requiredUserFields(form: UserFormState, creating: boolean): (keyof UserFormState)[] {
  if (!form.role) return ['role'];
  const fields: (keyof UserFormState)[] = ['role', 'fullName'];
  if (creating) fields.push('email');
  if (form.role === 'student') fields.push('libraryCardNumber', 'studentNumber', 'programId', 'yearLevel', 'academicTermId');
  else if (form.role === 'alumni') fields.push('libraryCardNumber');
  else if (form.role === 'employee') fields.push('employeeNumber', 'departmentId');
  else if (form.role) fields.push('username');
  return fields;
}
export function validateUserForm(form: UserFormState, creating: boolean): UserFieldErrors {
  const errors: UserFieldErrors = {};
  for (const field of requiredUserFields(form, creating)) if (!form[field].trim()) errors[field] = 'This field is required.';
  if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) errors.email = 'Enter a valid email address.';
  if (form.username.length > 64 && !borrowingRoles.includes(form.role)) errors.username = 'Use 64 characters or fewer.';
  return errors;
}
export const suggestUsername = (name: string) => name.trim().toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '').slice(0, 60);
