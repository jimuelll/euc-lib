import { useCallback, useEffect, useState, type MutableRefObject } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AdminStatusBadge, AdminRowMenu, AdminEmptyState, useAdminConfirmDialog } from "@/features/admin";
import { toast } from "@/components/ui/sonner";
import { getApiErrorMessage } from "@/utils/apiError";
import { formatLibraryDate } from "@/utils/libraryTime";
import { fetchBookHoldings, addCatalogCopies, retireCatalogCopy, restoreCatalogCopy, assignAccessionRange, type CatalogHolding } from "../catalog.api";
import { catalogKeys } from "../../catalog.keys";
import { printCatalogLabels } from "../catalog.labels";
import { printHolding } from "../catalog.holdings-print";
import BookHoldingsEditor from "./BookHoldingsEditor";
import { Barcode, ChevronDown } from "@/components/ui/library-glyphs";
type Props={bookId:number;bookTitle:string;initialCopyId?:number|null;initialAddOpen?:boolean;guardRef:MutableRefObject<(()=>Promise<boolean>)|null>;isSuperAdmin:boolean;onBusyChange?:(busy:boolean)=>void;onSelectionChange?:(id:number|null)=>void;needsOnly?:boolean;onNeedsOnlyChange?:(value:boolean)=>void;onDirtyChange?:(value:boolean)=>void};
export default function BookCopiesWorkspace({bookId,bookTitle,initialCopyId,initialAddOpen=false,guardRef,isSuperAdmin,onBusyChange,onSelectionChange,needsOnly=false,onNeedsOnlyChange,onDirtyChange}:Props){
 const queryClient=useQueryClient();const query=useQuery({queryKey:catalogKeys.bookHoldings(bookId),queryFn:({signal})=>fetchBookHoldings(bookId,signal)});const copies=query.data??[];
 const[localEditing,setLocalEditing]=useState<number|null>(initialCopyId??null);const editing=onSelectionChange?initialCopyId??null:localEditing;
 const setEditing=(id:number|null)=>{setLocalEditing(id);onSelectionChange?.(id);};
 const[prefillAccession,setPrefillAccession]=useState(false);
 const[holdingDirty,setHoldingDirty]=useState(false);
 const handleHoldingDirty=useCallback((value:boolean)=>{setHoldingDirty(value);onDirtyChange?.(value);},[onDirtyChange]);
 const[holdingBusy,setHoldingBusy]=useState(false);const[addOpen,setAddOpen]=useState(initialAddOpen);const[count,setCount]=useState("1");const[busy,setBusy]=useState(false);const[error,setError]=useState("");const{confirm,confirmDialog}=useAdminConfirmDialog();
 const[bulkOpen,setBulkOpen]=useState(false);const[start,setStart]=useState("");const[bulkCount,setBulkCount]=useState("1");const[bulkError,setBulkError]=useState("");
 const eligible=copies.filter(copy=>Boolean(copy.is_active)&&!copy.accession_voided&&!copy.accession_number?.trim());
 const shown=needsOnly?eligible:copies;
 const countValue=Number(bulkCount);const validRange=/^\d{1,64}$/.test(start)&&Number.isInteger(countValue)&&countValue>0&&countValue<=Math.min(100,eligible.length);
 const preview=validRange?eligible.slice(0,countValue).map((copy,index)=>({copy,number:(BigInt(start)+BigInt(index)).toString().padStart(start.length,"0")})):[];
 const validPreview=validRange&&preview.every(item=>item.number.length<=64);
 const sharedPolicy=copies[0]?.book_type||"Not assigned";
 useEffect(()=>{onBusyChange?.(busy||holdingBusy);return()=>onBusyChange?.(false);},[busy,holdingBusy,onBusyChange]);
 useEffect(()=>{if(editing!==null)requestAnimationFrame(()=>{document.getElementById(`copy-${editing}-editor`)?.scrollIntoView?.({block:"nearest",behavior:"auto"});document.getElementById("holding-accession")?.focus({preventScroll:true});});},[editing]);
 const run=async(action:()=>Promise<unknown>,message:string)=>{if(busy||holdingBusy)return;if(guardRef.current&&!await guardRef.current())return;setEditing(null);setBusy(true);try{await action();await queryClient.invalidateQueries({queryKey:catalogKeys.all});toast.success(message);}catch(err){toast.error(getApiErrorMessage(err,"Could not update this copy"));}finally{setBusy(false);}};
 const selectCopy=async(id:number|null)=>{if(busy||holdingBusy)return false;if(guardRef.current&&!await guardRef.current())return false;setPrefillAccession(false);setEditing(id);return true;};
 const add=async()=>{const value=Number(count);if(busy||!Number.isInteger(value)||value<1||value>100)return;setBusy(true);setError("");try{const previousIds=new Set(copies.map(copy=>copy.copy_id));await addCatalogCopies(bookId,value);await queryClient.invalidateQueries({queryKey:catalogKeys.all});const refreshed=queryClient.getQueryData<CatalogHolding[]>(catalogKeys.bookHoldings(bookId))??[];setAddOpen(false);setEditing(refreshed.find(copy=>!previousIds.has(copy.copy_id))?.copy_id??null);toast.success("Copies added. Add accession numbers below before lending.");}catch(err){setError(getApiErrorMessage(err,"Could not add copies"));}finally{setBusy(false);}};
 const retire=async(copy:CatalogHolding)=>{if(await confirm({title:"Retire this copy?",description:"This copy will no longer be lendable. Its barcode, accession and transaction history are retained. Active loans and reservations must be resolved first.",actionLabel:"Retire copy",tone:"danger"}))await run(()=>retireCatalogCopy(copy.copy_id),"Copy retired");};
 const assignRange=async()=>{if(!validPreview||busy)return;setBusy(true);setBulkError("");try{await assignAccessionRange(bookId,preview.map(item=>item.copy.copy_id),start);await queryClient.invalidateQueries({queryKey:catalogKeys.all});setBulkOpen(false);toast.success(`${preview.length} accession numbers assigned.`);}catch(err){setBulkError(getApiErrorMessage(err,"Could not assign accession numbers"));}finally{setBusy(false);}};
 const state=(copy:CatalogHolding)=>copy.accession_voided?"Voided":!copy.is_active?"Retired":copy.circulation_status==="borrowed"?"Borrowed":copy.circulation_status==="reserved"?"Reserved":!copy.accession_number?.trim()?"Needs accession number":["lost","weeded","discarded"].includes(copy.condition)?copy.condition.charAt(0).toUpperCase()+copy.condition.slice(1):copy.needs_policy?"Needs loan policy":copy.borrow_eligible?"Available":"Not lendable";
 return <section className="catalog-copies-workspace" aria-label="Copies of this record">
  <div className="catalog-copies-toolbar">
   <span className="catalog-copy-completion">{query.data?`${copies.filter(copy=>Boolean(copy.accession_number)&&!copy.accession_voided).length} of ${copies.length} accessioned`:"Loading copies..."}</span>
   <Button variant="outline" disabled={busy||holdingBusy||!eligible.length} onClick={async()=>{if(!await selectCopy(null))return;setStart("");setBulkCount(String(Math.min(eligible.length,100)));setBulkError("");setBulkOpen(true);}}>Assign accession numbers…</Button>
   <Button disabled={busy||holdingBusy} onClick={async()=>{if(!await selectCopy(null))return;setCount("1");setError("");setAddOpen(true);}}>Add copy</Button>
  </div>
  {copies.length>0&&<p className="catalog-secondary">All copies: {sharedPolicy}</p>}
  {needsOnly&&<div className="catalog-warning">Showing copies that need accession. <Button variant="outline" onClick={async()=>{if(await selectCopy(null))onNeedsOnlyChange?.(false);}}>Show all copies</Button></div>}
  {query.isPending?<p role="status">Loading copies...</p>:query.isError?<div role="alert">Could not load copies. <Button variant="outline" onClick={()=>void query.refetch()}>Retry</Button></div>:!shown.length?<AdminEmptyState title={needsOnly?"No copies need accession":"No physical copies"} description="Add a copy, then assign its accession number before lending."/>:<ul className="catalog-copy-list">
   {shown.map(copy=>{
    const selected=editing===copy.copy_id,sequence=copy.barcode.match(/-(\d+)$/)?.[1];
    const label=sequence&&Number(sequence)>0?`Copy ${Number(sequence)}`:`Copy ID ${copy.copy_id}`;
    return <li key={copy.copy_id} className="catalog-copy-row" data-selected={selected}>
     <div className="catalog-copy-heading">
      <button className="catalog-copy-toggle" disabled={busy||holdingBusy} aria-expanded={selected} aria-controls={`copy-${copy.copy_id}-editor`} onClick={()=>void selectCopy(selected?null:copy.copy_id)}>
       <Barcode aria-hidden="true"/><span><strong>{label}</strong>{" "}<span className="catalog-identifier">{copy.barcode} · {copy.accession_number?`Acc. ${copy.accession_number}`:"Accession not assigned"}</span></span><ChevronDown aria-hidden="true" className={selected?"is-open":""}/>
      </button>
      <AdminStatusBadge status={state(copy)==="Available"?"eligible":state(copy)==="Borrowed"?"borrowed":state(copy)==="Reserved"?"ready":state(copy)==="Needs accession number"||state(copy)==="Needs loan policy"?"pending":"cancelled"}>{state(copy)} · {copy.condition}</AdminStatusBadge>
     </div>
     <p className="catalog-copy-policy catalog-secondary">{[(copy.book_type||"Not assigned")!==sharedPolicy?`Loan policy: ${copy.book_type||"Not assigned"}`:"",copy.borrower_name?`Borrowed by ${copy.borrower_name}`:"",copy.due_date?`Due ${formatLibraryDate(copy.due_date)}`:"",copy.location||""].filter(Boolean).join(" · ")}</p>
     <div className="catalog-copy-controls">
      {!copy.accession_number?.trim()&&Boolean(copy.is_active)&&!selected&&<Button variant="outline" disabled={busy||holdingBusy} onClick={()=>void selectCopy(copy.copy_id)}>Assign</Button>}
      {selected&&<AdminRowMenu disabled={busy||holdingBusy} label={`Actions for ${copy.barcode}`} items={[{label:"Print holdings record",disabled:holdingDirty,onSelect:()=>void printHolding(copy)},{label:"Print label",onSelect:()=>void printCatalogLabels([copy.barcode])},copy.is_active?{label:"Retire copy",destructive:true,disabled:Boolean(copy.has_active_loan||copy.has_ready_reservation),onSelect:()=>void retire(copy)}:{label:"Restore copy",onSelect:()=>void run(()=>restoreCatalogCopy(copy.copy_id),"Copy restored")} ]}/>}
     </div>
     {selected&&<div id={`copy-${copy.copy_id}-editor`} className="catalog-copy-expanded"><nav className="catalog-copy-navigation" aria-label="Copies of this record"><p>Copies of this record · {shown.indexOf(copy)+1} of {shown.length}</p><div><Button variant="outline" disabled={busy||holdingBusy||shown.indexOf(copy)===0} onClick={()=>void selectCopy(shown[shown.indexOf(copy)-1]?.copy_id??null)}>Previous</Button><Button variant="outline" disabled={busy||holdingBusy||shown.indexOf(copy)>=shown.length-1} onClick={()=>void selectCopy(shown[shown.indexOf(copy)+1]?.copy_id??null)}>Next</Button></div></nav><BookHoldingsEditor key={`${bookId}-${copy.copy_id}`} inline bookId={bookId} bookTitle={bookTitle} copyId={copy.copy_id} guardRef={guardRef} isSuperAdmin={isSuperAdmin} onBusyChange={setHoldingBusy} onDirtyChange={handleHoldingDirty} onManageCopies={()=>void selectCopy(null)} navigation={{position:shown.findIndex(item=>item.copy_id===copy.copy_id),total:shown.length,label:"Copies of this record",onPrevious:()=>void selectCopy(shown[shown.indexOf(copy)-1]?.copy_id??null),onNext:()=>void selectCopy(shown[shown.indexOf(copy)+1]?.copy_id??null)}} prefillAccession={prefillAccession} onSavedNext={()=>{setPrefillAccession(true);setEditing(shown[shown.indexOf(copy)+1]?.copy_id??null);}}/></div>}
    </li>;
   })}
  </ul>}
 <Dialog open={bulkOpen} onOpenChange={value=>{if(!busy)setBulkOpen(value);}}><DialogContent className="catalog-accession-dialog"><DialogHeader><DialogTitle>Assign accession numbers</DialogTitle><DialogDescription>Review the assignments. Accession numbers are permanent and cannot be reused.</DialogDescription></DialogHeader><label htmlFor="bulk-start">Start number</label><Input id="bulk-start" inputMode="numeric" value={start} onChange={event=>setStart(event.target.value)} maxLength={64}/><label htmlFor="bulk-count">Number of copies</label><Input id="bulk-count" type="number" min="1" max={Math.min(100,eligible.length)} value={bulkCount} onChange={event=>setBulkCount(event.target.value)}/>{validPreview&&<div className="catalog-bulk-preview" aria-label="Accession assignment preview"><strong>Review assignments</strong><ul>{preview.map(item=><li key={item.copy.copy_id}>{item.copy.barcode} → {item.number}</li>)}</ul></div>}{bulkError&&<p role="alert">{bulkError}</p>}<DialogFooter><Button variant="outline" disabled={busy} onClick={()=>setBulkOpen(false)}>Cancel</Button><Button disabled={busy||!validPreview} onClick={()=>void assignRange()}>{busy?"Assigning…":"Confirm assignments"}</Button></DialogFooter></DialogContent></Dialog>
 <Dialog open={addOpen} onOpenChange={value=>{if(!busy)setAddOpen(value);}}><DialogContent><DialogHeader><DialogTitle>Add copies</DialogTitle><DialogDescription>Create physical copies of {bookTitle}. Add their accession numbers in this Copies tab before lending.</DialogDescription></DialogHeader><label htmlFor="copy-add-count">Number of copies</label><Input id="copy-add-count" type="number" min="1" max="100" value={count} onChange={e=>setCount(e.target.value)}/>{error&&<p role="alert">{error}</p>}<DialogFooter><Button variant="outline" disabled={busy} onClick={()=>setAddOpen(false)}>Cancel</Button><Button disabled={busy||!Number.isInteger(Number(count))||Number(count)<1||Number(count)>100} onClick={()=>void add()}>{busy?"Adding...":"Add copies"}</Button></DialogFooter></DialogContent></Dialog>{confirmDialog}</section>;
}
