// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import CatalogImageEditor from "./CatalogImageEditor";
import { uploadCatalogBookImage } from "../catalog.api";
vi.mock("../catalog.api",()=>({fetchCatalogImageMetadata:vi.fn().mockResolvedValue({bytes:1000,width:200,height:300}),uploadCatalogBookImage:vi.fn(),removeCatalogBookImage:vi.fn()}));
afterEach(cleanup);
it("shows image metadata and keeps immediate-save feedback after upload",async()=>{
 vi.mocked(uploadCatalogBookImage).mockResolvedValue({image_url:"https://images.example/new.jpg",image_public_id:"new",bytes:2048,width:400,height:600});
 function Editor(){const [image,setImage]=useState<string|null>(null);return <CatalogImageEditor book={{id:1,title:"Atlas",author:"A",material_type:"book",image_url:image}} onImageChange={url=>setImage(url)}/>;}
 render(<Editor/>);
 const file=new File(["image"],"cover.jpg",{type:"image/jpeg"});
 fireEvent.change(screen.getByLabelText("Choose book cover image"),{target:{files:[file]}});
 await waitFor(()=>expect(screen.getByText("Image saved immediately.")).toBeTruthy());
 expect(screen.getByText("Dimensions: 400 × 600 px")).toBeTruthy();
 expect(screen.getByText("File size: 2.0 KB")).toBeTruthy();
 expect(screen.queryByText(/Theses always/)).toBeNull();
});
