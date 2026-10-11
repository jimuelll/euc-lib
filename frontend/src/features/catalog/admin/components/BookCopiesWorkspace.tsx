import { useEffect, useState, type MutableRefObject } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input, Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AdminStatusBadge, AdminRowMenu, AdminEmptyState, useAdminConfirmDialog } from "@/features/admin";
import { toast } from "@/components/ui/sonner";
import { getApiErrorMessage } from "@/utils/apiError";
import { fetchBookHoldings, addCatalogCopies, retireCatalogCopy, restoreCatalogCopy, updateCatalogCopyCondition, type CatalogCopy, type CatalogHolding } from "../catalog.api";
import { catalogKeys } from "../../catalog.keys";
import { printCatalogLabels } from "../catalog.labels";
import BookHoldingsEditor from "./BookHoldingsEditor";
import { Barcode, ChevronDown } from "@/components/ui/library-glyphs";
type Props={bookId:number;bookTitle:string;initialCopyId?:number|null;initialAddOpen?:boolean;guardRef:MutableRefObject<(()=>Promise<boolean>)|null>;isSuperAdmin:boolean;onBusyChange?:(busy:boolean)=>void;onSelectionChange?:(id:number|null)=>void};
export default function BookCopiesWorkspace({bookId,bookTitle,initialCopyId,initialAddOpen=false,guardRef,isSuperAdmin,onBusyChange,onSelectionChange}:Props){
 const queryClient=useQueryClient();const query=useQuery({queryKey:catalogKeys.bookHoldings(bookId),queryFn:({signal})=>fetchBookHoldings(bookId,signal)});const copies=query.data??[];
 const[localEditing,setLocalEditing]=useState<number|null>(initialCopyId??null);const editing=onSelectionChange?initialCopyId??null:localEditing;
 const setEditing=(id:number|null)=>{setLocalEditing(id);onSelectionChange?.(id);};
 const[holdingBusy,setHoldingBusy]=useState(false);const[addOpen,setAddOpen]=useState(initialAddOpen);const[count,setCount]=useState("1");const[busy,setBusy]=useState(false);const[error,setError]=useState("");const{confirm,confirmDialog}=useAdminConfirmDialog();
 useEffect(()=>{onBusyChange?.(busy||holdingBusy);return()=>onBusyChange?.(false);},[busy,holdingBusy,onBusyChange]);
 useEffect(()=>{if(editing!==null)requestAnimationFrame(()=>{document.getElementById(`copy-${editing}-editor`)?.scrollIntoView?.({block:"nearest",behavior:"auto"});document.getElementById("holding-accession")?.focus({preventScroll:true});});},[editing]);
 const run=async(action:()=>Promise<unknown>,message:string)=>{if(busy||holdingBusy)return;if(guardRef.current&&!await guardRef.current())return;setEditing(null);setBusy(true);try{await action();await queryClient.invalidateQueries({queryKey:catalogKeys.all});toast.success(message);}catch(err){toast.error(getApiErrorMessage(err,"Could not update this copy"));}finally{setBusy(false);}};
 const selectCopy=async(id:number|null)=>{if(busy||holdingBusy)return false;if(guardRef.current&&!await guardRef.current())return false;setEditing(id);return true;};
 const add=async()=>{const value=Number(count);if(busy||!Number.isInteger(value)||value<1||value>100)return;setBusy(true);setError("");try{const previousIds=new Set(copies.map(copy=>copy.copy_id));await addCatalogCopies(bookId,value);await queryClient.invalidateQueries({queryKey:catalogKeys.all});const refreshed=queryClient.getQueryData<CatalogHolding[]>(catalogKeys.bookHoldings(bookId))??[];setAddOpen(false);setEditing(refreshed.find(copy=>!previousIds.has(copy.copy_id))?.copy_id??null);toast.success("Copies added. Add accession numbers below before lending.");}catch(err){setError(getApiErrorMessage(err,"Could not add copies"));}finally{setBusy(false);}};
 const retire=async(copy:CatalogHolding)=>{if(await confirm({title:"Retire this copy?",description:"This copy will no longer be lendable. Its barcode, accession and transaction history are retained. Active loans and reservations must be resolved first.",actionLabel:"Retire copy",tone:"danger"}))await run(()=>retireCatalogCopy(copy.copy_id),"Copy retired");};
 const state=(copy:CatalogHolding)=>copy.accession_voided?"Voided":!copy.is_active?"Retired":copy.circulation_status==="borrowed"?"Borrowed":copy.circulation_status==="reserved"?"Reserved":!copy.accession_number?"Needs accession number":copy.condition==="lost"?"Lost":copy.needs_policy?"Needs loan policy":copy.borrow_eligible?"Available":"Not lendable";
 return <section className="catalog-copies-workspace" aria-label="Copies of this record">
  <div className="catalog-copies-toolbar">
   <span className="catalog-copy-completion">{query.data?`${copies.filter(copy=>Boolean(copy.accession_number)&&!copy.accession_voided).length} of ${copies.length} accessioned`:"Loading copies..."}</span>
   <Button disabled={busy||holdingBusy} onClick={async()=>{if(!await selectCopy(null))return;setCount("1");setError("");setAddOpen(true);}}>Add copy</Button>
  </div>
  {query.isPending?<p role="status">Loading copies...</p>:query.isError?<div role="alert">Could not load copies. <Button variant="outline" onClick={()=>void query.refetch()}>Retry</Button></div>:!copies.length?<AdminEmptyState title="No physical copies" description="Add a copy, then assign its accession number before lending."/>:<ul className="catalog-copy-list">
   {copies.map(copy=>{
    const selected=editing===copy.copy_id,sequence=copy.barcode.match(/-(\d+)$/)?.[1];
    const label=sequence&&Number(sequence)>0?`Copy ${Number(sequence)}`:`Copy ID ${copy.copy_id}`;
    return <li key={copy.copy_id} className="catalog-copy-row" data-selected={selected}>
     <div className="catalog-copy-heading">
      <button className="catalog-copy-toggle" disabled={busy||holdingBusy} aria-expanded={selected} aria-controls={`copy-${copy.copy_id}-editor`} onClick={()=>void selectCopy(selected?null:copy.copy_id)}>
       <Barcode aria-hidden="true"/><span><strong>{label}</strong>{" "}<span className="catalog-identifier">{copy.barcode} · {copy.accession_number?`Acc. ${copy.accession_number}`:"Accession not assigned"}</span></span><ChevronDown aria-hidden="true" className={selected?"is-open":""}/>
      </button>
      <AdminStatusBadge status={state(copy)==="Available"?"eligible":state(copy)==="Borrowed"?"borrowed":state(copy)==="Reserved"?"ready":state(copy)==="Needs accession number"||state(copy)==="Needs loan policy"?"pending":"cancelled"}>{state(copy)} · {copy.condition}</AdminStatusBadge>
     </div>
     <p className="catalog-copy-policy catalog-secondary">Loan policy: <span>{copy.book_type||"Not assigned"}</span>{copy.borrower_name?` · Borrowed by ${copy.borrower_name}`:""}{copy.due_date?` · Due ${new Date(copy.due_date).toLocaleDateString()}`:""} · {copy.location||"Location not recorded"}</p>
     <div className="catalog-copy-controls">
      <Select value={copy.condition} disabled={busy||holdingBusy} onValueChange={value=>void run(()=>updateCatalogCopyCondition(copy.copy_id,value as CatalogCopy["condition"]),"Condition updated")}><SelectTrigger aria-label={`Condition of ${copy.barcode}`}><span>Condition: <SelectValue/></span></SelectTrigger><SelectContent><SelectItem value="good">Good</SelectItem><SelectItem value="damaged">Damaged</SelectItem><SelectItem value="lost">Lost</SelectItem></SelectContent></Select>
      {!copy.accession_number&&Boolean(copy.is_active)&&!selected&&<Button variant="outline" disabled={busy||holdingBusy} onClick={()=>void selectCopy(copy.copy_id)}>Add accession number</Button>}
      <AdminRowMenu disabled={busy||holdingBusy} label={`Actions for ${copy.barcode}`} items={[{label:"Edit accession details",onSelect:()=>void selectCopy(copy.copy_id)},{label:"Print label",onSelect:()=>void printCatalogLabels([copy.barcode])},copy.is_active?{label:"Retire copy",destructive:true,disabled:Boolean(copy.has_active_loan||copy.has_ready_reservation),onSelect:()=>void retire(copy)}:{label:"Restore copy",onSelect:()=>void run(()=>restoreCatalogCopy(copy.copy_id),"Copy restored")} ]}/>
     </div>
     {selected&&<div id={`copy-${copy.copy_id}-editor`} className="catalog-copy-expanded"><BookHoldingsEditor key={`${bookId}-${copy.copy_id}`} inline bookId={bookId} bookTitle={bookTitle} copyId={copy.copy_id} guardRef={guardRef} isSuperAdmin={isSuperAdmin} onBusyChange={setHoldingBusy} onManageCopies={()=>void selectCopy(null)} navigation={{position:copies.findIndex(item=>item.copy_id===copy.copy_id),total:copies.length,label:"Copies of this record",onPrevious:()=>void selectCopy(copies[copies.indexOf(copy)-1]?.copy_id??null),onNext:()=>void selectCopy(copies[copies.indexOf(copy)+1]?.copy_id??null)}} onSavedNext={()=>setEditing(copies[copies.indexOf(copy)+1]?.copy_id??null)}/></div>}
    </li>;
   })}
  </ul>}
 <Dialog open={addOpen} onOpenChange={value=>{if(!busy)setAddOpen(value);}}><DialogContent><DialogHeader><DialogTitle>Add copies</DialogTitle><DialogDescription>Create physical copies of {bookTitle}. Add their accession numbers in this Copies tab before lending.</DialogDescription></DialogHeader><label htmlFor="copy-add-count">Number of copies</label><Input id="copy-add-count" type="number" min="1" max="100" value={count} onChange={e=>setCount(e.target.value)}/>{error&&<p role="alert">{error}</p>}<DialogFooter><Button variant="outline" disabled={busy} onClick={()=>setAddOpen(false)}>Cancel</Button><Button disabled={busy||!Number.isInteger(Number(count))||Number(count)<1||Number(count)>100} onClick={()=>void add()}>{busy?"Adding...":"Add copies"}</Button></DialogFooter></DialogContent></Dialog>{confirmDialog}</section>;
}
