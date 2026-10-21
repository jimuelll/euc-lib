// @vitest-environment jsdom
import {act,cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {createTestQueryClientWrapper} from '@/test-utils/query-client';
import BookLookup from './BookLookup';
import ReturnLookup from './ReturnLookup';
import UserLookup from './UserLookup';
const scanner=vi.hoisted(()=>({decode:null as null|((text:string)=>void),error:null as string|null}));
vi.mock('@/features/scan-qr',()=>({useZxingScanner:({onResult}:{onResult:(text:string)=>void})=>{scanner.decode=onResult;return {videoRef:{current:null},error:scanner.error};}}));
vi.mock('@/features/admin',()=>({AdminIcon:()=>null,searchAdminUsers:vi.fn().mockResolvedValue([])}));
vi.mock('../circulation.api',()=>({fetchCirculationBookCopies:vi.fn(),searchCirculationBooks:vi.fn()}));
vi.mock('./ReturnFineActions',()=>({default:()=>null}));
beforeEach(()=>{scanner.decode=null;scanner.error=null;});afterEach(cleanup);
it('camera patron scan populates and looks up the identifier once',()=>{
 const change=vi.fn(),lookup=vi.fn();render(<UserLookup studentId="" onStudentIdChange={change} onLookup={lookup} lookingUp={false} foundUser={null}/>,{wrapper:createTestQueryClientWrapper()});
 fireEvent.click(screen.getByRole('button',{name:'Scan patron ID'}));
 expect((screen.getByLabelText('Scanner camera preview') as HTMLVideoElement).style.transform).toBe('scaleX(-1)');
 act(()=>{scanner.decode?.(' ID-001 ');scanner.decode?.('ID-001');});
 expect(change).toHaveBeenCalledWith('ID-001');expect(lookup).toHaveBeenCalledExactlyOnceWith('ID-001');expect(screen.queryByRole('dialog')).toBeNull();
});
it('camera checkout scan loads the copy without recording a borrowing',()=>{
 const change=vi.fn(),lookup=vi.fn();render(<BookLookup copyBarcode="" onCopyBarcodeChange={change} onLookup={lookup} onSelectCopy={vi.fn()} lookingUp={false} disabled={false} foundCopy={null}/>,{wrapper:createTestQueryClientWrapper()});
 fireEvent.click(screen.getByRole('button',{name:'Scan copy'}));act(()=>scanner.decode?.('LIB-001'));
 expect(change).toHaveBeenCalledWith('LIB-001');expect(lookup).toHaveBeenCalledExactlyOnceWith('LIB-001');
});
it('camera return scan always loads a preview and never confirms a return',()=>{
 const change=vi.fn(),lookup=vi.fn(),confirm=vi.fn();render(<ReturnLookup identifier="" onIdentifierChange={change} onLookup={lookup} onConfirm={confirm} lookingUp={false} submitting={false} preview={null} receipt={null} error=""/>);
 fireEvent.click(screen.getByRole('button',{name:'Scan return copy'}));act(()=>scanner.decode?.('ACC-001'));
 expect(change).toHaveBeenCalledWith('ACC-001');expect(lookup).toHaveBeenCalledExactlyOnceWith('ACC-001');expect(confirm).not.toHaveBeenCalled();
});
it('shows a camera error with a manual fallback and closes the scanner',()=>{
 scanner.error='Could not start camera';render(<ReturnLookup identifier="" onIdentifierChange={vi.fn()} onLookup={vi.fn()} onConfirm={vi.fn()} lookingUp={false} submitting={false} preview={null} receipt={null} error=""/>);
 fireEvent.click(screen.getByRole('button',{name:'Scan return copy'}));expect(screen.getByRole('alert').textContent).toContain('use a USB scanner');
 fireEvent.click(screen.getByRole('button',{name:'Close scanner'}));expect(screen.queryByRole('dialog')).toBeNull();
});
