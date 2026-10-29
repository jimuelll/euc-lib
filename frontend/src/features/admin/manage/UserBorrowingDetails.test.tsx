// @vitest-environment jsdom
import {useState} from 'react';
import {afterEach,it,expect,vi} from 'vitest';
import {cleanup,render,screen,waitFor,fireEvent} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {MemoryRouter} from 'react-router-dom';
import {createTestQueryClientWrapper} from '@/test-utils/query-client';
import UserBorrowingDetails from './UserBorrowingDetails';
import {fetchUserBorrowing} from './api';
vi.mock('./api',()=>({fetchUserBorrowing:vi.fn()}));
afterEach(()=>{cleanup();vi.resetAllMocks();});
const empty={activeLoans:[],fineRows:[],activeReservations:[],summary:{activeLoans:0,overdueLoans:0,unpaidFines:0,activeReservations:0}};
function Wrapper({children}:{children:React.ReactNode}) {const [Query]=useState(()=>createTestQueryClientWrapper());return <Query><MemoryRouter>{children}</MemoryRouter></Query>;}
it('loads only when opened and renders exact copies, fine amounts and reservations',async()=>{
 vi.mocked(fetchUserBorrowing).mockResolvedValue({...empty,activeLoans:[{id:1,book_title:'86—Eighty-Six',accession_number:'ACC-1',copy_barcode:'COPY-1',status:'overdue',borrowed_at:'2026-10-01T00:00:00Z',due_date:'2026-10-15T00:00:00Z'}],fineRows:[{id:2,book_title:'Returned book',copy_barcode:'COPY-2',fine_amount:100,settled_amount:40,unsettled_amount:60}],activeReservations:[{id:3,book_title:'Reserved book',status:'ready',expires_at:null}],summary:{activeLoans:1,overdueLoans:1,unpaidFines:60,activeReservations:1}});
 const result=render(<UserBorrowingDetails identifier="CARD-6" enabled={false}/>,{wrapper:Wrapper});expect(fetchUserBorrowing).not.toHaveBeenCalled();
 result.rerender(<UserBorrowingDetails identifier="CARD-6" enabled/>);
 expect(await screen.findByText('ACC-1')).toBeVisible();expect(screen.getByText('Returned book')).toBeVisible();expect(screen.getByText('Ready for pickup')).toBeVisible();expect(screen.getByText('Settled')).toBeVisible();expect(screen.getAllByText(/60.00/)).toHaveLength(2);
 expect(fetchUserBorrowing).toHaveBeenCalledWith('CARD-6',expect.any(AbortSignal));
});
it('shows independent empty states and never presents a failed request as zero',async()=>{
 vi.mocked(fetchUserBorrowing).mockResolvedValue(empty);
 const result=render(<UserBorrowingDetails identifier="A" enabled/>,{wrapper:Wrapper});
 expect(await screen.findByText('No books currently borrowed.')).toBeVisible();expect(screen.getByText('No unpaid fines.')).toBeVisible();expect(screen.getByText('No active reservations.')).toBeVisible();
 vi.mocked(fetchUserBorrowing).mockRejectedValue(new Error('Offline'));result.rerender(<UserBorrowingDetails identifier="B" enabled/>);
 expect(await screen.findByRole('alert')).toHaveTextContent('could not be loaded');expect(screen.queryByText('No unpaid fines.')).toBeNull();
});
it('cancels an obsolete patron request when the selection changes',async()=>{
 let oldSignal:AbortSignal|undefined;
 vi.mocked(fetchUserBorrowing).mockImplementation((id,signal)=>id==='A'?(oldSignal=signal,new Promise(()=>{})):Promise.resolve(empty));
 const result=render(<UserBorrowingDetails identifier="A" enabled/>,{wrapper:Wrapper});await waitFor(()=>expect(oldSignal).toBeDefined());
 result.rerender(<UserBorrowingDetails identifier="B" enabled/>);
 expect(await screen.findByText('No books currently borrowed.')).toBeVisible();expect(oldSignal?.aborted).toBe(true);
});

it('refreshes on reopening and allows retry after a failed load',async()=>{
 vi.mocked(fetchUserBorrowing).mockResolvedValue(empty);
 const result=render(<UserBorrowingDetails identifier="A" enabled/>,{wrapper:Wrapper});
 await screen.findByText('No books currently borrowed.');
 const initial=vi.mocked(fetchUserBorrowing).mock.calls.length;
 result.rerender(<UserBorrowingDetails identifier="A" enabled={false}/>);
 result.rerender(<UserBorrowingDetails identifier="A" enabled/>);
 await waitFor(()=>expect(fetchUserBorrowing).toHaveBeenCalledTimes(initial+1));
 vi.mocked(fetchUserBorrowing).mockRejectedValueOnce(new Error('Offline'));
 result.rerender(<UserBorrowingDetails identifier="B" enabled/>);
 fireEvent.click(await screen.findByRole('button',{name:'Retry borrowing details'}));
 expect(await screen.findByText('No unpaid fines.')).toBeVisible();
});
