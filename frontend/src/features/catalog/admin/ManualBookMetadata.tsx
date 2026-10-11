import {Link} from 'react-router-dom';
import {AdminRowMenu,AdminDetailDrawer,useUnsavedChanges,formatAdminDate,AdminStatusChip} from '@/features/admin';
import { useEffect, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { fetchManualBookMetadata, fetchManualMetadataBooks, saveManualBookMetadata, type ManualBookMetadata, type ManualMetadataBook,type EmbeddingStatus,fetchRecommendationPreview } from "./catalog.api";
import { Check, CircleAlert, Sparkles } from "@/components/ui/library-glyphs";
import { catalogKeys } from "../catalog.keys";
import { useDebounce } from "@/hooks/use-debounce";
import { getApiErrorMessage } from "@/utils/apiError";

const statusLabel: Record<ManualMetadataBook["metadataStatus"], string> = {
  missing: "Needs details",
  failed: "Lookup failed",
  ready: "Details found",
  manual: "Added by staff",
};

const synopsisLabel: Record<ManualMetadataBook["synopsisStatus"], string> = {
  present: "Found",
  not_checked: "Not checked",
  no_description: "Not found",
  lookup_failed: "Lookup failed",
  missing: "Needs staff input",
};

type Props={backfillRevision?:number;filter?:string;onFilter?:(value:string)=>void;coverage?:EmbeddingStatus;clearFilter?:()=>void;selectedIds?:number[];onSelection?:(ids:number[])=>void;onLookup?:(id:number)=>void;running?:boolean};
const ManualBookMetadata = ({ backfillRevision = 0,filter='all',onFilter=()=>{},coverage,clearFilter=()=>{},selectedIds=[],onSelection=()=>{},onLookup=()=>{},running=false }: Props) => {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1),[limit,setLimit]=useState(25),[sort,setSort]=useState('attention');
  useEffect(()=>setPage(1),[filter]);
  const [previewBook,setPreviewBook]=useState<ManualMetadataBook|null>(null);
  const previewQuery=useQuery({queryKey:[...catalogKeys.embeddings(),'preview',previewBook?.id],queryFn:({signal})=>fetchRecommendationPreview(previewBook!.id,signal),enabled:Boolean(previewBook)});
  const [selectedBook, setSelectedBook] = useState<ManualMetadataBook | null>(null);
  const [summary, setSummary] = useState("");
  const [subjectsText, setSubjectsText] = useState("");
  const [publisher, setPublisher] = useState("");
  const [categoriesText, setCategoriesText] = useState("");
  const [language, setLanguage] = useState("");
  const [pageCountText, setPageCountText] = useState("");
  const [publishedDate, setPublishedDate] = useState("");
  const [formError, setFormError] = useState("");
  const debouncedQuery = useDebounce(query.trim(), 220);
  const listFilters={query:debouncedQuery,needsAttention:filter==='attention',page,limit,synopsis:filter==='synopses'?'blank':'all',embedding:filter==='matching'?'needed':filter==='ready'?'ready':'all',details:filter==='details'?'missing':'all',sort};
  const booksQuery = useQuery({
    queryKey: catalogKeys.manualMetadataBooks(listFilters),
    queryFn: ({ signal }) => fetchManualMetadataBooks(listFilters, signal),
    placeholderData: keepPreviousData,
  });
  const detailsQuery = useQuery({
    queryKey: catalogKeys.manualBookMetadata(selectedBook?.id ?? 0),
    queryFn: ({ signal }) => fetchManualBookMetadata(selectedBook!.id, signal),
    enabled: Boolean(selectedBook),
  });
  const books = booksQuery.data?.rows ?? [];
  const total = booksQuery.data?.pagination.total ?? 0;
  const totalPages = booksQuery.data?.pagination.totalPages ?? 1;
  const loadingBooks = booksQuery.isFetching;
  const listError = booksQuery.isError ? getApiErrorMessage(booksQuery.error, "Books could not be loaded. Try again.") : "";
  const details = detailsQuery.data ?? null;
  const loadingDetails = detailsQuery.isPending;
  const saveMutation = useMutation({
    mutationFn: ({ bookId, payload }: { bookId: number; payload: Parameters<typeof saveManualBookMetadata>[1] }) => saveManualBookMetadata(bookId, payload),
    onSuccess: async (_result, variables) => {
      await queryClient.invalidateQueries({ queryKey: catalogKeys.embeddings() });
      await queryClient.invalidateQueries({ queryKey: catalogKeys.manualBookMetadata(variables.bookId) });
    },
  });
  const saving = saveMutation.isPending;
  const dirty=Boolean(details)&&JSON.stringify([summary,subjectsText,publisher,categoriesText,language,pageCountText,publishedDate])!==JSON.stringify([details!.summary,details!.subjects.join('\n'),details!.additionalDetails.publisher,details!.additionalDetails.categories.join('\n'),details!.additionalDetails.language,details!.additionalDetails.pageCount==null?'':String(details!.additionalDetails.pageCount),details!.additionalDetails.publishedDate]);
  const guard=useUnsavedChanges({},Boolean(selectedBook),selectedBook?.id??0,dirty);

  useEffect(() => {
    if (backfillRevision > 0) void queryClient.invalidateQueries({ queryKey: catalogKeys.embeddings() });
  }, [backfillRevision, queryClient]);

  useEffect(() => {
    const result = detailsQuery.data;
    if (!result || result.book.id !== selectedBook?.id) return;
    setSummary(result.summary);
    setSubjectsText(result.subjects.join("\n"));
    setPublisher(result.additionalDetails.publisher);
    setCategoriesText(result.additionalDetails.categories.join("\n"));
    setLanguage(result.additionalDetails.language);
    setPageCountText(result.additionalDetails.pageCount == null ? "" : String(result.additionalDetails.pageCount));
    setPublishedDate(result.additionalDetails.publishedDate);
  }, [detailsQuery.data, selectedBook?.id]);

  const openBook = (book: ManualMetadataBook) => {
    setSelectedBook(book);
    setSummary("");
    setSubjectsText("");
    setPublisher("");
    setCategoriesText("");
    setLanguage("");
    setPageCountText("");
    setPublishedDate("");
    setFormError("");
  };

  const closeEditor = async () => {
    if (saving||!await guard.confirmDiscard()) return;
    setSelectedBook(null);
    setFormError("");
  };

  const save = async () => {
    if (!selectedBook || !details) return;
    const subjects = [...new Set(subjectsText.split(/\r?\n/).map((value) => value.trim()).filter(Boolean))];
    const categories = [...new Set(categoriesText.split(/\r?\n/).map((value) => value.trim()).filter(Boolean))];
    const cleanPageCount = pageCountText.trim() ? Number(pageCountText) : null;
    if (!summary.trim() && !subjects.length && !publisher.trim() && !categories.length && !language.trim() && cleanPageCount == null && !publishedDate.trim()) {
      setFormError("Add at least one book detail before saving.");
      return;
    }
    if (cleanPageCount != null && (!Number.isInteger(cleanPageCount) || cleanPageCount < 1 || cleanPageCount > 100000)) {
      setFormError("Page count must be a whole number from 1 to 100,000.");
      return;
    }
    setFormError("");
    try {
      const result = await saveMutation.mutateAsync({ bookId: selectedBook.id, payload: {
        summary: summary.trim(), subjects,
        additionalDetails: { publisher: publisher.trim(), categories, language: language.trim(), pageCount: cleanPageCount, publishedDate: publishedDate.trim() },
      } });
      setSummary(result.summary);
      setSubjectsText(result.subjects.join("\n"));
      setPublisher(result.additionalDetails.publisher);
      setCategoriesText(result.additionalDetails.categories.join("\n"));
      setLanguage(result.additionalDetails.language);
      setPageCountText(result.additionalDetails.pageCount == null ? "" : String(result.additionalDetails.pageCount));
      setPublishedDate(result.additionalDetails.publishedDate);
      if (result.embeddingStatus === "ready") {
        if (summary.trim()) toast.success("Book details saved and AI recommendations updated.");
        else toast.warning("Book details saved. The AI synopsis is still missing.");
        guard.markSaved();setSelectedBook(null);
      } else {
        const message = `Your book details were saved, but AI recommendations could not be updated: ${result.embeddingError || "Please try again later."}`;
        setFormError(message);
        toast.error("Details saved; AI update needs attention.");
      }
    } catch (error: unknown) {
      setFormError(getApiErrorMessage(error, "Details could not be saved. Check your connection and try again."));
    }
  };

  const metadataStatus = details?.metadataStatus || selectedBook?.metadataStatus;
  const currentSynopsisStatus = details?.synopsisStatus || selectedBook?.synopsisStatus;
  return (
    <>
      <section aria-labelledby="manual-ai-details-heading" className="ai-book-list">
       <div className="ai-list-title"><h2 id="manual-ai-details-heading">Book readiness</h2><span className="ai-muted">{total} active books match</span></div>
       <div className="ai-list-sticky"><label className="ai-search-label" htmlFor="ai-book-search">Search</label><Input id="ai-book-search" aria-label="Search books by title, author, or ISBN" placeholder="Search title, author or ISBN…" value={query} onChange={e=>{setQuery(e.target.value);setPage(1);}}/>
        <div className="ai-list-filters" role="group" aria-label="Book data filters">{[
         ['attention','Needs attention',coverage?.needsAttention],['synopses','Needs synopsis',coverage?.missingSynopses],['details','Needs book details',coverage?.missingDetails],['matching','Needs matching',coverage?coverage.total-coverage.ready:undefined],['all','All',coverage?.total]
        ].map(([value,label,count])=><Button key={String(value)} variant="outline" aria-pressed={filter===value} onClick={()=>onFilter(String(value))}>{filter===value&&<Check aria-hidden="true"/>}{label} {count??'—'}</Button>)}<label>Sort by<select aria-label="Sort books" value={sort} onChange={e=>{setSort(e.target.value);setPage(1);}}><option value="attention">Needs attention first</option><option value="title">Title</option><option value="author">Author</option></select></label></div>
        {(filter!=='all'||query)&&<div className="ai-filter-summary"><span>{filter==='all'?'All books':filter==='synopses'?'Missing synopsis':filter==='details'?'Missing book details':filter==='matching'?'Missing AI data':'Needs attention'}{query?` · “${query}”`:''}</span><Button variant="ghost" onClick={()=>{clearFilter();setQuery('');setPage(1);}}>Clear filters</Button></div>}
        {selectedIds.length>0&&<div className="ai-filter-summary"><span>{selectedIds.length} books selected across pages</span><Button variant="ghost" onClick={()=>onSelection([])}>Clear selection</Button></div>}
        <div className="ai-book-head"><label className="ai-selection"><input type="checkbox" aria-label="Select all books on this page" checked={books.length>0&&books.every(book=>selectedIds.includes(book.id))} ref={input=>{if(input)input.indeterminate=books.some(book=>selectedIds.includes(book.id))&&!books.every(book=>selectedIds.includes(book.id));}} disabled={!books.length||booksQuery.isPlaceholderData} onChange={e=>onSelection(e.target.checked?[...new Set([...selectedIds,...books.map(book=>book.id)])]:selectedIds.filter(id=>!books.some(book=>book.id===id)))}/></label><span>Book</span><span>Synopsis</span><span title="A saved synopsis, subjects, publisher, language, page count or publication details">Book details</span><span>AI matching</span><span>Actions</span></div>
       </div>
       {listError&&<p role="alert" className="ai-error">{listError}<Button variant="outline" onClick={()=>void booksQuery.refetch()}>Try again</Button></p>}
       {loadingBooks&&!booksQuery.data?<p className="ai-empty" role="status">Loading book readiness…</p>:books.length?<><ul className="ai-books" aria-label="Book readiness list">{books.map(book=><li className="ai-book-row" key={book.id}>
        <label className="ai-selection"><input type="checkbox" aria-label={`Select ${book.title}`} checked={selectedIds.includes(book.id)} onChange={e=>onSelection(e.target.checked?[...selectedIds,book.id]:selectedIds.filter(id=>id!==book.id))}/></label>
        <div className="ai-book-identity"><img src={book.imageUrl||'/book-cover-fallback.svg'} alt="" loading="lazy" onError={e=>{e.currentTarget.onerror=null;e.currentTarget.src='/book-cover-fallback.svg';}}/><div className="ai-book-name"><button className="ai-link" onClick={()=>openBook(book)}>{book.title}</button><span title={book.author||'Author not listed'}>{book.author||'Author not listed'}</span><code>{book.isbn||'No ISBN'}</code>{(book.synopsisStatus!=='present'||book.embeddingStatus!=='ready'||book.metadataStatus==='missing')&&<small className="ai-attention-reason">{[book.synopsisStatus!=='present'?'No synopsis':'',!book.isbn?'No ISBN for lookup':'',book.metadataStatus==='missing'?'Missing book details':'',book.embeddingStatus!=='ready'?'AI data needs update':''].filter(Boolean).join(' · ')}</small>}</div></div>
        <div data-label="Synopsis"><AdminStatusChip tone={book.synopsisStatus==='present'?'success':book.synopsisStatus==='not_checked'?'warning':'danger'} title={book.synopsisStatus==='not_checked'?'No successful synopsis check is recorded.':undefined}>{synopsisLabel[book.synopsisStatus]}</AdminStatusChip></div>
        <div data-label="Book details"><AdminStatusChip tone={book.metadataStatus==='ready'||book.metadataStatus==='manual'?'success':'danger'}>{book.metadataStatus==='ready'?'Found':statusLabel[book.metadataStatus]}</AdminStatusChip></div>
        <div data-label="AI matching"><AdminStatusChip tone={book.embeddingStatus==='ready'?'success':'danger'}>{book.embeddingStatus==='ready'?'Ready':book.embeddingStatus==='failed'?'Failed':'Missing'}</AdminStatusChip></div>
        <div className="ai-row-actions"><Button variant="outline" disabled={book.synopsisStatus==='not_checked'&&(running||!book.isbn)} onClick={()=>book.synopsisStatus==='not_checked'?onLookup(book.id):openBook(book)}>{book.synopsisStatus==='present'?'Edit':book.synopsisStatus==='not_checked'?'Retry lookup':'Add synopsis'}</Button><AdminRowMenu label={`Actions for ${book.title}`} items={[{label:'Preview recommendations',onSelect:()=>setPreviewBook(book)},{label:'Add or edit synopsis',onSelect:()=>openBook(book)},{label:book.isbn?'Fetch online for this book':'Lookup unavailable · no ISBN',disabled:running||!book.isbn,onSelect:()=>onLookup(book.id)},{label:'Open catalog record',onSelect:()=>window.location.assign(`/admin/catalog?tab=records&bookId=${book.id}`)}]}/></div>
       </li>)}</ul><div className="ai-pagination"><span>Showing {Math.min(total,(page-1)*limit+1)}–{Math.min(page*limit,total)} of {total}</span><label>Rows per page <select aria-label="Rows per page" value={limit} onChange={e=>{setLimit(Number(e.target.value));setPage(1);}}>{[10,25,50].map(n=><option key={n}>{n}</option>)}</select></label><Button variant="outline" disabled={page<=1||booksQuery.isPlaceholderData} onClick={()=>setPage(page-1)}>Previous</Button><span>Page {page} of {totalPages}</span><Button variant="outline" disabled={page>=totalPages||booksQuery.isPlaceholderData} onClick={()=>setPage(page+1)}>Next</Button></div></>:!listError?<div className="ai-empty"><Check aria-hidden="true"/><p>{filter==='attention'?'All matching books are complete.':'No books match these filters.'}</p><Button variant="outline" onClick={()=>{clearFilter();setQuery('');setPage(1);}}>View all books</Button><Link className="ai-link" to="/admin/catalog">Open Catalog →</Link></div>:null}
      </section>
      <AdminDetailDrawer className="ai-preview-drawer" open={Boolean(previewBook)} onClose={()=>setPreviewBook(null)} title={`Recommendations for ${previewBook?.title||'Book'}`} description="The same suggestions shown in the public catalog. Uses saved book data; no patron history or external provider call.">
       {previewQuery.isPending?<p role="status">Loading recommendations…</p>:previewQuery.isError?<p role="alert" className="ai-error">{getApiErrorMessage(previewQuery.error,'Could not preview recommendations.')}<Button variant="outline" onClick={()=>void previewQuery.refetch()}>Retry</Button></p>:previewQuery.data?.rows.length?<ul className="ai-preview-results">{previewQuery.data.rows.map(row=><li key={row.id}><Link className="ai-link" to={`/admin/catalog?tab=records&bookId=${row.id}`}>{row.title}</Link><p>{row.author||'Author not listed'} · {row.reason}</p><AdminStatusChip tone={row.source==='ai'?'success':'neutral'}>{row.source==='ai'?'AI match':'Catalog match'}</AdminStatusChip></li>)}</ul>:<p>No similar titles are available. Add useful book details and check eligible titles in the catalog.</p>}
      </AdminDetailDrawer>
      <AdminDetailDrawer className="ai-details-drawer" open={Boolean(selectedBook)} title={`Book details: ${selectedBook?.title||'Book'}`} description="Synopsis and details used for AI recommendations. Changes are recorded in the audit log." onClose={()=>void closeEditor()} footer={<><span role="status">{saving?'Saving…':guard.dirty?'Unsaved changes':'No unsaved changes'}</span><Button variant="outline" disabled={saving} onClick={()=>void closeEditor()}>Cancel</Button><Button type="submit" form="ai-details-editor" disabled={saving||loadingDetails||!details||!guard.dirty}>{saving?'Saving and updating…':'Save details'}</Button></>}>
       {loadingDetails?<p role="status" className="text-sm text-muted-foreground">Loading book details…</p>:detailsQuery.isError?<div role="alert" className="ai-error">{getApiErrorMessage(detailsQuery.error,'Book details could not be loaded.')}<Button variant="outline" onClick={()=>void detailsQuery.refetch()}>Try again</Button></div>:<form id="ai-details-editor" className="space-y-5" onSubmit={e=>{e.preventDefault();void save();}}>
                {selectedBook?.isbn ? <p className="text-xs text-muted-foreground">ISBN {selectedBook.isbn}</p> : <p className="text-xs text-muted-foreground">No ISBN is recorded. You can still add details below.</p>}
                {metadataStatus === "failed" ? <Alert variant="destructive"><CircleAlert className="size-4" /><AlertDescription>The online details lookup failed{details?.metadataError ? `: ${details.metadataError}` : "."} This is separate from its AI matching status. You can still add details below.</AlertDescription></Alert> : null}
                {metadataStatus === "ready" ? <Alert><Sparkles className="size-4" /><AlertDescription>Book details were found online. Review them and correct anything that looks wrong.</AlertDescription></Alert> : null}
                {metadataStatus === "manual" ? <Alert><Check className="size-4" /><AlertDescription>These details were added by library staff. You can update them here.</AlertDescription></Alert> : null}
                {currentSynopsisStatus === "lookup_failed" ? <Alert variant="destructive"><CircleAlert className="size-4" /><AlertDescription>The synopsis lookup failed{details?.synopsisError ? `: ${details.synopsisError}` : ". You can retry Refresh book data later or add the synopsis manually."}</AlertDescription></Alert> : null}
                {currentSynopsisStatus === "no_description" ? <Alert><Sparkles className="size-4" /><AlertDescription>The available online sources did not provide a synopsis. Add one manually if available.</AlertDescription></Alert> : null}
                {currentSynopsisStatus === "not_checked" ? <Alert><Sparkles className="size-4" /><AlertDescription>No synopsis has been imported yet. Refresh book data checks Open Library first, then Google Books, and Hardcover when configured.</AlertDescription></Alert> : null}
                {currentSynopsisStatus === "missing" ? <Alert><CircleAlert className="size-4" /><AlertDescription>No synopsis is recorded. You can add one manually below.</AlertDescription></Alert> : null}

                <section aria-labelledby="other-book-details-heading" className="ai-metadata-section space-y-4">
                  <div>
                    <h3 id="other-book-details-heading" className="text-sm font-semibold text-foreground">Book details</h3>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">{details?.source === "openlibrary_googlebooks" ? "Review and edit the details found during the ISBN lookup." : "Add any other details you know about the book."}</p>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2"><Label htmlFor="ai-book-publisher">Publisher</Label><Input id="ai-book-publisher" maxLength={200} placeholder="Publisher name" value={publisher} onChange={(event) => setPublisher(event.target.value)} /></div>
                    <div className="space-y-2"><Label htmlFor="ai-book-language">Language</Label><Input id="ai-book-language" maxLength={80} placeholder="For example, English" value={language} onChange={(event) => setLanguage(event.target.value)} /></div>
                    <div className="space-y-2"><Label htmlFor="ai-book-page-count">Page count</Label><Input id="ai-book-page-count" type="number" min={1} max={100000} step={1} placeholder="Number of pages" value={pageCountText} onChange={(event) => setPageCountText(event.target.value)} /></div>
                    <div className="space-y-2"><Label htmlFor="ai-book-published-date">Publication date</Label><Input id="ai-book-published-date" maxLength={64} placeholder="For example, 2021 or May 2021" value={publishedDate} onChange={(event) => setPublishedDate(event.target.value)} /></div>
                  </div>
                  <div className="space-y-2"><Label htmlFor="ai-book-categories">Categories</Label><Textarea id="ai-book-categories" className="min-h-24 resize-y" placeholder={"One category per line, for example:\nHistory\nNatural science"} value={categoriesText} onChange={(event) => setCategoriesText(event.target.value)} /><p className="text-xs leading-5 text-muted-foreground">Add one category per line.</p></div>
                </section>

                <div className="space-y-2">
                  <Label htmlFor="ai-book-summary">Synopsis · What is this book about?</Label>
                  <Textarea id="ai-book-summary" className="min-h-36 resize-y" maxLength={8000} placeholder="Write a few sentences about the book’s main ideas or story." value={summary} onChange={(event) => setSummary(event.target.value)} />
                  <p className="text-xs leading-5 text-muted-foreground">A short description is enough. Leave this blank if you only know the topics.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ai-book-subjects">Subjects or topics</Label>
                  <Textarea id="ai-book-subjects" className="min-h-28 resize-y" placeholder={"One topic per line, for example:\nPhilippine history\nEcology\nStudy skills"} value={subjectsText} onChange={(event) => setSubjectsText(event.target.value)} />
                  <p className="text-xs leading-5 text-muted-foreground">Add one topic per line. Enter at least one detail in this form to save.</p>
                </div>
                {formError ? <Alert variant={formError.startsWith("Your book details were saved") ? "default" : "destructive"}><CircleAlert className="size-4" /><AlertDescription>{formError}</AlertDescription></Alert> : null}

       {details?.staffEditedAt&&<p className="text-xs text-muted-foreground">Last entered by {details.staffEditedBy||'staff'} · {formatAdminDate(details.staffEditedAt)}</p>}
       </form>}
      </AdminDetailDrawer>{guard.discardDialog}
    </>
  );
};

export default ManualBookMetadata;
