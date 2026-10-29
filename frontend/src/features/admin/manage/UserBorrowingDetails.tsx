import {Link} from 'react-router-dom';
import {useQuery} from '@tanstack/react-query';
import {fetchUserBorrowing} from './api';
import {Button} from '@/components/ui/button';
import {formatPeso} from '@/features/admin';

export interface UserBorrowing {
 activeLoans: {id:number;book_title:string;accession_number:string|null;copy_barcode:string|null;borrowed_at:string;due_date:string;status:string}[];
 fineRows: {id:number;book_title:string;copy_barcode:string|null;fine_amount:number;settled_amount:number;unsettled_amount:number}[];
 activeReservations: {id:number;book_title:string;status:string;expires_at:string|null}[];
 summary: {activeLoans:number;overdueLoans:number;unpaidFines:number;activeReservations:number};
}
const date=(value:string|null)=>value&&Number.isFinite(Date.parse(value))?new Intl.DateTimeFormat('en-PH',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Manila'}).format(new Date(value)):'Not recorded';
export default function UserBorrowingDetails({identifier,enabled}:{identifier:string;enabled:boolean}) {
 const query=useQuery({queryKey:['admin-user-borrowing',identifier],enabled,queryFn:({signal})=>fetchUserBorrowing(identifier,signal),staleTime:0,refetchOnMount:'always'});
 const history=`/admin/circulation?tab=history&search=${encodeURIComponent(identifier)}`;
 const clearance=`/admin/clearance?student_employee_id=${encodeURIComponent(identifier)}`;
 if(query.isPending)return <p role="status">Loading borrowing details…</p>;
 if(query.isError)return <div role="alert"><p>Borrowing details could not be loaded.</p><Button type="button" variant="outline" onClick={()=>void query.refetch()}>Retry borrowing details</Button></div>;
 const {activeLoans,fineRows,activeReservations,summary}=query.data;
 return <div className="users-obligations" aria-label="Current borrowing obligations" aria-busy={query.isFetching}>
  <section className="users-borrowing-summary library-slip" aria-label="Borrowing summary"><h3>Borrowing</h3><div>
   <Link to={history}><strong>{summary.activeLoans}</strong><span>Active loans</span></Link>
   <Link to={`${history}&filter=overdue`}><strong className={summary.overdueLoans?'users-attention':''}>{summary.overdueLoans}</strong><span>Overdue</span></Link>
   <Link to={clearance}><strong className={summary.unpaidFines?'users-attention':''}>{formatPeso(summary.unpaidFines)}</strong><span>Unpaid fines</span></Link>
  </div></section>
  <section className="users-obligation-section"><h3>Borrowed books</h3>{!activeLoans.length?<p>No books currently borrowed.</p>:<ul>{activeLoans.map(loan=><li key={loan.id}><h4>{loan.book_title}</h4><p className={loan.status==='overdue'?'users-attention':''}>{loan.status==='overdue'?'Overdue':'Borrowed'}</p><dl><div><dt>Copy</dt><dd>{loan.accession_number||loan.copy_barcode||'Not recorded'}</dd></div><div><dt>Borrowed</dt><dd>{date(loan.borrowed_at)}</dd></div><div><dt>Due</dt><dd>{date(loan.due_date)}</dd></div></dl></li>)}</ul>}<Link to={history}>View circulation history</Link></section>
  <section className="users-obligation-section"><h3>Unpaid fines</h3>{!fineRows.length?<p>No unpaid fines.</p>:<ul>{fineRows.map(fine=><li key={fine.id}><h4>{fine.book_title}</h4><p>Copy: <span className="users-record-number">{fine.copy_barcode||'Not recorded'}</span></p><dl><div><dt>Assessed</dt><dd>{formatPeso(fine.fine_amount)}</dd></div><div><dt>Settled</dt><dd>{formatPeso(fine.settled_amount)}</dd></div><div><dt>Remaining</dt><dd className="users-attention">{formatPeso(fine.unsettled_amount)}</dd></div></dl></li>)}</ul>}<Link to={clearance}>Review clearance and payments</Link></section>
  <section className="users-obligation-section"><h3>Active reservations <span>({summary.activeReservations})</span></h3>{!activeReservations.length?<p>No active reservations.</p>:<ul>{activeReservations.map(reservation=><li key={reservation.id}><h4>{reservation.book_title}</h4><p>{reservation.status==='ready'?'Ready for pickup':'Pending'}</p>{reservation.expires_at&&<p>Expires {date(reservation.expires_at)}</p>}</li>)}</ul>}<Link to={`/admin/reservations?q=${encodeURIComponent(identifier)}&filter=needs_action`}>View reservations</Link></section>
 </div>;
}
