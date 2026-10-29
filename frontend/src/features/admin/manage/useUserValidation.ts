import { isOperationsRole } from "@/utils/operationsAccess";
import { useEffect, useRef, useState } from 'react';
import { checkUserAvailability } from './api';
import type { UserFormState } from './AdminManage.types';
import { validateUserForm, type UserFieldErrors } from './userForm';

export function useUserValidation(form: UserFormState, creating: boolean, enabled: boolean, excludeIdentifier?: string) {
  const [touched, setTouched] = useState<Partial<Record<keyof UserFormState, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);
  const [serverErrors, setServerErrors] = useState<UserFieldErrors>({});
  const [checks, setChecks] = useState<Record<string, {value:string; error?:string}>>({});
  const previousForm = useRef(form);
  const formSnapshot = JSON.stringify(form);
  const lastBlur = useRef<{username:string;email:string}|null>(null);
  const [blurVersion, setBlurVersion] = useState(0);
  const validation = validateUserForm(form, creating);
  const username = !['student','staff','employee','alumni'].includes(form.role) && form.role ? form.username.trim() : '';
  const email = isOperationsRole(form.role) ? "" : form.email.trim();
  useEffect(() => { setTouched({}); setSubmitted(false); setServerErrors({}); setChecks({}); }, [enabled, creating, excludeIdentifier]);
  useEffect(() => {
    const previous = previousForm.current;
    previousForm.current = form;
    setServerErrors(old => Object.fromEntries(Object.entries(old).filter(([key]) =>
      previous.role === form.role && previous[key as keyof UserFormState] === form[key as keyof UserFormState]
    )));
  }, [formSnapshot]);
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      for (const [field, value] of [['username',username],['email',email]] as const) {
        if (!value || field === 'username' && value.length>64 || (field === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))) continue;
        void checkUserAvailability(field,value,excludeIdentifier,controller.signal).then(result => {
          if (!controller.signal.aborted) setChecks(old=>({...old,[field]:{value,error:result.available ? undefined : `This ${field} already belongs to another user.`}}));
        }).catch(() => {
          if (!controller.signal.aborted) setChecks(old=>({...old,[field]:{value,error:'Could not check availability. Retry by leaving this field.'}}));
        });
      }
    }, lastBlur.current?.username===username && lastBlur.current?.email===email ? 0 : 400);
    return () => {clearTimeout(timer);controller.abort();};
  }, [username,email,excludeIdentifier,enabled,blurVersion]);
  const errors: UserFieldErrors = {...validation,...serverErrors};
  for (const [field,value] of [['username',username],['email',email]] as const) if (value && checks[field]?.value === value && checks[field].error) errors[field]=checks[field].error;
  const checking = enabled && Boolean(username && !validation.username && checks.username?.value !== username || email && !validation.email && checks.email?.value !== email);
  return {errors, checking, valid:!Object.keys(errors).length && !checking,
    visibleError:(key:keyof UserFormState)=>touched[key] || submitted || serverErrors[key] ? errors[key] : undefined,
    blur:(key:keyof UserFormState)=>{setTouched(old=>({...old,[key]:true}));if(key==='email'||key==='username'){lastBlur.current={username,email};setBlurVersion(old=>old+1);}},
    submit:()=>setSubmitted(true),setServerErrors,
  };
}
