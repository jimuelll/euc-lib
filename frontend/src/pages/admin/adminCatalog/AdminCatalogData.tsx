import { useState } from "react";
import axiosInstance from "@/utils/AxiosInstance";
import {
  Input,
  Label,
  Button,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui";
import { toast } from "@/components/ui/sonner";
import { FormField, Book } from "./AdminCatalog.types";
import FieldInput from "./components/FieldInput";

type Props = { fields: FormField[] };

const AdminCatalogData = ({ fields }: Props) => {
  const [catalogMode, setCatalogMode]     = useState<"create" | "edit">("create");
  const [formValues, setFormValues]       = useState<Record<string, any>>({});
  const [loading, setLoading]             = useState(false);
  const [searchQuery, setSearchQuery]     = useState("");
  const [searchResults, setSearchResults] = useState<Book[]>([]);
  const [selectedBook, setSelectedBook]   = useState<Book | null>(null);

  const sortedFields = [...fields].sort((a, b) => a.order - b.order);

  const setField   = (key: string, value: any) =>
    setFormValues((prev) => ({ ...prev, [key]: value }));

  const resetForm  = () => { setFormValues({}); setSelectedBook(null); };

  const validateRequired = () => {
    for (const f of fields.filter((f) => f.required)) {
      if (!formValues[f.key]) { toast.error(`${f.label} is required`); return false; }
    }
    return true;
  };

  const handleCreateBook = async () => {
    if (!validateRequired()) return;
    setLoading(true);
    try {
      const res = await axiosInstance.post("api/admin/books", formValues);
      toast.success(res.data.message);
      resetForm();
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || "Failed to add book");
    } finally { setLoading(false); }
  };

  const handleSearchBooks = async () => {
    if (!searchQuery.trim()) { toast.error("Enter a title, author, or ISBN"); return; }
    setLoading(true);
    try {
      const res = await axiosInstance.get("api/admin/books", { params: { query: searchQuery } });
      setSearchResults(res.data);
      if (!res.data.length) toast.info("No books found");
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || "Search failed");
    } finally { setLoading(false); }
  };

  const handleUpdateBook = async () => {
    if (!selectedBook || !validateRequired()) return;
    setLoading(true);
    try {
      const res = await axiosInstance.put(`api/admin/books/${selectedBook.id}`, formValues);
      toast.success(res.data.message);
      resetForm();
      setSearchResults([]);
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || "Update failed");
    } finally { setLoading(false); }
  };

  const handleDeleteBook = async () => {
    if (!selectedBook) return;
    if (!confirm(`Delete "${selectedBook.title}"?`)) return;
    setLoading(true);
    try {
      const res = await axiosInstance.delete(`api/admin/books/${selectedBook.id}`);
      toast.success(res.data.message);
      resetForm();
      setSearchResults((prev) => prev.filter((b) => b.id !== selectedBook.id));
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || "Delete failed");
    } finally { setLoading(false); }
  };

  const selectBookForEdit = (b: Book) => {
    setSelectedBook(b);
    const vals: Record<string, any> = {};
    fields.forEach((f) => { vals[f.key] = b[f.key] ?? ""; });
    setFormValues(vals);
  };

  return (
    <>
      {/* Sub-mode */}
      <div className="mt-4">
        <Label className="text-xs">Mode</Label>
        <Select value={catalogMode} onValueChange={(v) => { setCatalogMode(v as any); resetForm(); }}>
          <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="create">Add Book</SelectItem>
            <SelectItem value="edit">Edit / Search / Delete</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Create — 2-column grid for fields */}
      {catalogMode === "create" && (
        <form
          className="mt-4 rounded-lg border bg-card p-4"
          onSubmit={(e) => { e.preventDefault(); handleCreateBook(); }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {sortedFields.map((f) => (
              <div
                key={f.key}
                className={`space-y-1 ${f.type === "textarea" ? "sm:col-span-2" : ""}`}
              >
                <Label className="text-xs">
                  {f.label}
                  {f.required && <span className="ml-1 text-destructive">*</span>}
                </Label>
                <FieldInput field={f} value={formValues[f.key]} onChange={setField} />
              </div>
            ))}
          </div>
          <div className="mt-4 flex gap-2">
            <Button size="sm" type="submit" disabled={loading}>
              {loading ? "Adding..." : "Add Book"}
            </Button>
            <Button size="sm" type="button" variant="outline" onClick={resetForm} disabled={loading}>
              Clear
            </Button>
          </div>
        </form>
      )}

      {/* Edit / Search / Delete */}
      {catalogMode === "edit" && (
        <>
          <div className="mt-4 flex gap-2">
            <Input
              className="h-8 text-sm"
              placeholder="Search by title, author, or ISBN"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearchBooks()}
            />
            <Button size="sm" onClick={handleSearchBooks} disabled={loading}>
              {loading ? "Searching..." : "Search"}
            </Button>
          </div>

          {searchResults.length > 0 && (
            <div className="mt-3 overflow-x-auto rounded-lg border bg-card">
              <table className="w-full text-left text-xs text-foreground">
                <thead className="border-b bg-muted/40">
                  <tr>
                    <th className="px-3 py-2">Title</th>
                    <th className="px-3 py-2">Author</th>
                    <th className="px-3 py-2">Category</th>
                    <th className="px-3 py-2">Copies</th>
                  </tr>
                </thead>
                <tbody>
                  {searchResults.map((b) => (
                    <tr
                      key={b.id}
                      className="border-t cursor-pointer hover:bg-accent/20"
                      onClick={() => selectBookForEdit(b)}
                    >
                      <td className="px-3 py-2">{b.title}</td>
                      <td className="px-3 py-2">{b.author || "—"}</td>
                      <td className="px-3 py-2">{b.category || "—"}</td>
                      <td className="px-3 py-2">{b.copies ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {selectedBook && (
            <form
              className="mt-4 rounded-lg border bg-card p-4"
              onSubmit={(e) => { e.preventDefault(); handleUpdateBook(); }}
            >
              <p className="mb-3 text-xs font-semibold text-foreground">
                Editing: <span className="text-muted-foreground">{selectedBook.title}</span>
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {sortedFields.map((f) => (
                  <div
                    key={f.key}
                    className={`space-y-1 ${f.type === "textarea" ? "sm:col-span-2" : ""}`}
                  >
                    <Label className="text-xs">
                      {f.label}
                      {f.required && <span className="ml-1 text-destructive">*</span>}
                    </Label>
                    <FieldInput field={f} value={formValues[f.key]} onChange={setField} />
                  </div>
                ))}
              </div>
              <div className="mt-4 flex gap-2">
                <Button size="sm" type="submit" disabled={loading}>
                  {loading ? "Updating..." : "Update Book"}
                </Button>
                <Button size="sm" type="button" variant="destructive" onClick={handleDeleteBook} disabled={loading}>
                  {loading ? "Deleting..." : "Delete Book"}
                </Button>
              </div>
            </form>
          )}
        </>
      )}
    </>
  );
};

export default AdminCatalogData;