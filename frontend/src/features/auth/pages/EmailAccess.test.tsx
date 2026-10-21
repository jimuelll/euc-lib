// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import * as api from '../account-email.api';
import EmailAccess from './EmailAccess';
vi.mock('../account-email.api',()=>({requestRecovery:vi.fn(),verifyRecovery:vi.fn(),completeSetup:vi.fn(),completeReset:vi.fn(),verifyEmail:vi.fn()}));
const mount=(path:string)=>render(<MemoryRouter initialEntries={[path]}><EmailAccess/></MemoryRouter>);
beforeEach(()=>vi.resetAllMocks());afterEach(cleanup);
it('does not consume an email verification link when opened',async()=>{
  vi.mocked(api.verifyEmail).mockResolvedValue({message:'Email verified.'});
  mount('/verify-email#id=challenge-id&token=secret-token');
  expect(api.verifyEmail).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:'Verify email'}));
  await waitFor(()=>expect(api.verifyEmail).toHaveBeenCalledWith({id:'challenge-id',token:'secret-token'}));
  await screen.findByRole('heading',{name:'Account updated'});
});
it('sets an invitation password only after confirmation and uses the setup endpoint',async()=>{
  vi.mocked(api.completeSetup).mockResolvedValue({message:'Password saved. Sign in with your new password.'});
  mount('/set-password#id=challenge-id&token=secret-token');
  expect(api.verifyEmail).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('New password'),{target:{value:'Different123!'}});
  fireEvent.change(screen.getByLabelText('Confirm password'),{target:{value:'Different123!'}});
  fireEvent.click(screen.getByRole('button',{name:'Save password'}));
  await waitFor(()=>expect(api.completeSetup).toHaveBeenCalledWith({id:'challenge-id',token:'secret-token'},'Different123!'));
  await screen.findByRole('heading',{name:'Account updated'});
});
it('rejects mismatched password confirmation without calling an API',async()=>{
  mount('/set-password#id=challenge-id&token=secret-token');
  fireEvent.change(screen.getByLabelText('New password'),{target:{value:'Different123!'}});
  fireEvent.change(screen.getByLabelText('Confirm password'),{target:{value:'Other123!'}});
  fireEvent.click(screen.getByRole('button',{name:'Save password'}));
  expect((await screen.findByRole('alert')).textContent).toContain('Passwords do not match');expect(api.verifyEmail).not.toHaveBeenCalled();
});
it('completes recovery using an email code and a separate reset authorization',async()=>{
  vi.mocked(api.requestRecovery).mockResolvedValue({message:'Check inbox'});vi.mocked(api.verifyRecovery).mockResolvedValue({id:'reset-id',token:'reset-authorization'});vi.mocked(api.completeReset).mockResolvedValue({message:'Password saved.'});
  mount('/forgot-password');fireEvent.change(screen.getByLabelText('Email address'),{target:{value:'member@example.edu'}});fireEvent.click(screen.getByRole('button',{name:'Send recovery code'}));
  fireEvent.change(await screen.findByLabelText('Six-digit code'),{target:{value:'123456'}});expect(screen.getByRole('button',{name:/Resend in/}).hasAttribute('disabled')).toBe(true);fireEvent.click(screen.getByRole('button',{name:'Verify code'}));
  fireEvent.change(await screen.findByLabelText('New password'),{target:{value:'Different123!'}});fireEvent.change(screen.getByLabelText('Confirm password'),{target:{value:'Different123!'}});fireEvent.click(screen.getByRole('button',{name:'Save password'}));
  await screen.findByRole('heading',{name:'Account updated'});
  expect(api.requestRecovery).toHaveBeenCalledWith('member@example.edu');
  expect(api.verifyRecovery).toHaveBeenCalledWith('member@example.edu','123456');
  expect(api.completeReset).toHaveBeenCalledWith({id:'reset-id',token:'reset-authorization'},'Different123!');
});
it('retains a usable form and displays expired-link errors',async()=>{
  vi.mocked(api.verifyEmail).mockRejectedValue({response:{data:{message:'This code or link is invalid or expired. Request a new email.'}}});mount('/verify-email#id=old&token=expired');fireEvent.click(screen.getByRole('button',{name:'Verify email'}));
  expect((await screen.findByRole('alert')).textContent).toContain('expired');expect(screen.getByRole('button',{name:'Verify email'}).hasAttribute('disabled')).toBe(false);
});
