import { expect,it } from "vitest";
import { catalogImportPreview, csvText, parseCatalogCsv } from "./catalog.csv";
import { DEFAULT_FIELDS, type BookType } from "./AdminCatalog.types";
const policy={id:1,name:"General",is_active:1} as BookType;
it("parses quoted commas, escaped quotes and line breaks",()=>{expect(parseCatalogCsv('title,author\r\n"Book, One","A ""Writer"""\r\n')).toEqual([["title","author"],["Book, One",'A "Writer"']]);expect(()=>parseCatalogCsv('title\n"unclosed')).toThrow();});
it("checks schema, active policies, required fields and copy quantities",()=>{expect(()=>catalogImportPreview("title,unknown\nBook,X",DEFAULT_FIELDS,[policy])).toThrow("Unknown columns");const rows=catalogImportPreview("title,author,book_type_id,copies\nBook,Writer,9,-1\n,Writer,1,0",DEFAULT_FIELDS,[policy]);expect(rows[0].errors).toContain("An active book_type_id is required");expect(rows[0].errors).toContain("Copies must be a whole number from 0 to 1000");expect(rows[1].errors).toContain("Title is required");});
it("keeps repeatable values and protects exported spreadsheet cells",()=>{const rows=catalogImportPreview("title,author,book_type_id,editors\nBook,Writer,1,One|Two",DEFAULT_FIELDS,[policy]);expect(rows[0].values.editors).toEqual(["One","Two"]);expect(csvText([["=SUM(A1:A2)","safe"]])).toContain('"\'=SUM(A1:A2)"');});
