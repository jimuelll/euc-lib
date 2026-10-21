// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import PasswordChangeGate from './PasswordChangeGate';
vi.mock('@/context/AuthContext',()=>({useAuth:()=>({user:{must_change_password:true},loading:false})}));
vi.mock('./PasswordChangeModal',()=>({default:()=> <div>Mandatory password change</div>}));
afterEach(cleanup);
it.each(['/forgot-password','/set-password','/verify-email','/change-password'])('allows %s while normal library access remains gated',path=>{
 render(<MemoryRouter initialEntries={[path]}><PasswordChangeGate/></MemoryRouter>);expect(screen.queryByText('Mandatory password change')).toBeNull();
});
it('continues to block normal library routes for legacy first-login accounts',()=>{
 render(<MemoryRouter initialEntries={['/my-library']}><PasswordChangeGate/></MemoryRouter>);expect(screen.getByText('Mandatory password change')).toBeTruthy();
});
