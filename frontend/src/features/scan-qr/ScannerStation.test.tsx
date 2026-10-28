// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import {act,cleanup,fireEvent,render,screen} from "@testing-library/react";
import {afterEach,beforeEach,expect,it,vi} from "vitest";
import {createTestQueryClientWrapper} from "@/test-utils/query-client";
import ScanQR,{ATTENDANCE_MODE_KEY} from "./index";
import {AttendanceScanError} from "./api";
const state=vi.hoisted(()=>({id:1,post:vi.fn(),cameraError:null as string|null,cameraActive:false,cameraPaused:false,decode:null as null|((value:string)=>void)}));
vi.mock("@/context/AuthContext",()=>({useAuth:()=>({user:{id:state.id,role:'scanner',name:'Scanner terminal'}})}));
vi.mock("@/components/layout/KioskHeader",()=>({default:()=>null}));
vi.mock("./api",async original=>({...await original<typeof import('./api')>(),postAttendanceScan:state.post}));
vi.mock("./hooks/useZxingScanner",()=>({useZxingScanner:({active,onResult,paused}:{active:boolean;paused:boolean;onResult:(value:string)=>void})=>{state.cameraActive=active;state.cameraPaused=paused;state.decode=onResult;return {videoRef:{current:null},error:state.cameraError};}}));
beforeEach(()=>{vi.useFakeTimers();localStorage.clear();state.id=1;state.cameraError=null;state.post.mockReset();state.post.mockImplementation(async(scannedId:string,type:string)=>({type,user:{name:'Maria Santos',student_employee_id:scannedId}}));});
afterEach(()=>{cleanup();vi.clearAllTimers();vi.useRealTimers();vi.restoreAllMocks();});
function mount(){const Wrapper=createTestQueryClientWrapper();return render(<Wrapper><ScanQR/></Wrapper>);}
async function scan(id:string){await act(async()=>{const input=screen.getByLabelText('Scan library ID');fireEvent.change(input,{target:{value:id}});fireEvent.submit(input.closest('form')!);await vi.advanceTimersByTimeAsync(0);});}
it('starts ready for a keyboard scanner, submits once, updates session data and refocuses after the result',async()=>{
 mount();expect(screen.getByLabelText('Scan library ID')).toHaveFocus();expect(screen.getByLabelText('Scan library ID')).toHaveAttribute('name','scannedId');
 expect(state.post).not.toHaveBeenCalled();
 await act(async()=>{const input=screen.getByLabelText('Scan library ID');fireEvent.change(input,{target:{value:' A001 '}});fireEvent.submit(input.closest('form')!);fireEvent.submit(input.closest('form')!);await vi.advanceTimersByTimeAsync(0);});
 expect(state.post).toHaveBeenCalledExactlyOnceWith('A001','check_in');
 expect(screen.getByText('Timed in')).toBeInTheDocument();expect(screen.getByRole('heading',{name:'Maria Santos'})).toBeInTheDocument();
 expect(document.querySelector('[data-scan-state="success"]')).toHaveAttribute('aria-live','assertive');
 expect(screen.getByText('Time-ins this session').parentElement?.querySelector('strong')).toHaveTextContent('1');
 expect(screen.getByLabelText('Recent scans in this session')).toHaveTextContent('Maria Santos');
 await act(()=>vi.advanceTimersByTimeAsync(4100));expect(screen.getByLabelText('Scan library ID')).toHaveFocus();
});
it('persists the selected mode across remounts and uses it for time-out scans',async()=>{
 const view=mount();fireEvent.click(screen.getByRole('button',{name:'Time out Departure'}));expect(localStorage.getItem(ATTENDANCE_MODE_KEY)).toBe('check_out');view.unmount();mount();
 fireEvent.click(screen.getByRole('button',{name:'Time out Departure'}));expect(screen.getByRole('button',{name:'Time out'})).toHaveAttribute('aria-pressed','true');await scan('A002');
 expect(state.post).toHaveBeenCalledWith('A002','check_out');expect(screen.getByText('Timed out')).toBeInTheDocument();
 expect(screen.getByText('Time-outs this session').parentElement?.querySelector('strong')).toHaveTextContent('1');
});
it('keeps duplicate attendance messages and does not count failed or repeated scans',async()=>{
 state.post.mockRejectedValue(new AttendanceScanError('Maria Santos is already timed in for today.',{code:'ALREADY_TIMED_IN',user:{name:'Maria Santos',student_employee_id:'A001'},type:'check_in'}));
 mount();await scan('A001');expect(screen.getByText('Already timed in')).toBeInTheDocument();expect(screen.getByText('Maria Santos is already timed in for today.')).toBeInTheDocument();
 expect(screen.getByText('Time-ins this session').parentElement?.querySelector('strong')).toHaveTextContent('0');expect(screen.getByText('No scans yet')).toBeInTheDocument();
 await act(()=>vi.advanceTimersByTimeAsync(4100));expect(screen.getByLabelText('Scan library ID')).toHaveFocus();
});
it.each([['ID not recognised — user not found','We couldn’t find that ID'],['Network Error','Could not record attendance']])('preserves the %s error and resets without changing session counts',async(message,heading)=>{
 state.post.mockRejectedValue(new AttendanceScanError(message));mount();await scan('MISSING');expect(screen.getByRole('heading',{name:heading})).toBeInTheDocument();expect(screen.getByText('Scanned: MISSING')).toBeInTheDocument();
 expect(screen.getByText('No scans yet')).toBeInTheDocument();await act(()=>vi.advanceTimersByTimeAsync(4100));expect(screen.getByLabelText('Scan library ID')).toHaveFocus();
});
it('keeps manual entry and the existing camera scanner available',async()=>{
 state.cameraError='Could not start camera';mount();fireEvent.click(screen.getByRole('button',{name:'Time in Arrival'}));expect(state.cameraActive).toBe(true);expect(screen.getByRole('alert')).toHaveTextContent('Could not start camera');
 fireEvent.click(screen.getByRole('button',{name:'Enter ID manually'}));expect(state.cameraActive).toBe(false);expect(screen.getByLabelText('Scan library ID')).toHaveAttribute('tabindex','0');await scan('MANUAL');expect(state.post).toHaveBeenCalledWith('MANUAL','check_in');
});
it('clears session-only data when the authenticated kiosk account changes',async()=>{
 const Wrapper=createTestQueryClientWrapper();const view=render(<Wrapper><ScanQR/></Wrapper>);await scan('A001');expect(screen.getByRole('heading',{name:'Maria Santos'})).toBeInTheDocument();state.id=2;view.rerender(<Wrapper><ScanQR/></Wrapper>);
 expect(screen.getByText('No scans yet')).toBeInTheDocument();expect(screen.getByText('Time-ins this session').parentElement?.querySelector('strong')).toHaveTextContent('0');
});

it('retains only the last five successful scans while counting the entire session',async()=>{
 mount();for(let index=1;index<=6;index++){await scan(`ID-${index}`);await act(()=>vi.advanceTimersByTimeAsync(4100));}
 const recent=screen.getByLabelText('Recent scans in this session');expect(recent.querySelectorAll('li')).toHaveLength(5);expect(recent).not.toHaveTextContent('ID-1');expect(recent.querySelector('li')).toHaveTextContent('ID-6');
 expect(screen.getByText('Time-ins this session').parentElement?.querySelector('strong')).toHaveTextContent('6');
});

it('starts camera in one tap, retains it through results, and stops on Stop or inactivity',async()=>{
 mount();expect(state.cameraActive).toBe(false);fireEvent.click(screen.getByRole('button',{name:'Time in Arrival'}));expect(state.cameraActive).toBe(true);
 await scan('QUEUE-1');expect(state.cameraActive).toBe(true);expect(state.cameraPaused).toBe(true);expect(screen.getByText('Camera reopens in 4 seconds')).toBeInTheDocument();
 await act(()=>vi.advanceTimersByTimeAsync(4100));expect(state.cameraActive).toBe(true);expect(state.cameraPaused).toBe(false);
 fireEvent.click(screen.getByRole('button',{name:'Time out'}));expect(localStorage.getItem(ATTENDANCE_MODE_KEY)).toBe('check_out');expect(state.cameraActive).toBe(true);
 fireEvent.click(screen.getByRole('button',{name:'Stop'}));expect(state.cameraActive).toBe(false);expect(screen.getByRole('button',{name:'Time in Arrival'})).toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'Time out Departure'}));await act(()=>vi.advanceTimersByTimeAsync(61000));expect(state.cameraActive).toBe(false);
});
it('releases the camera when the browser tab is hidden',()=>{
 mount();fireEvent.click(screen.getByRole('button',{name:'Time in Arrival'}));expect(state.cameraActive).toBe(true);
 vi.spyOn(document,'visibilityState','get').mockReturnValue('hidden');fireEvent(document,new Event('visibilitychange'));expect(state.cameraActive).toBe(false);
});
