// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { CatalogueCompactCard, CatalogueCover } from "./catalogue-book";

afterEach(cleanup);
describe("catalogue monogram covers", () => {
  const book = { title: "Attack on Titan, Vol. 1", author: "Hajime Isayama", available: 1, registered_copies: 1 };
  it("keeps the title only in the shared card caption", () => {
    render(<MemoryRouter><CatalogueCompactCard book={book} /></MemoryRouter>);
    const cover = screen.getByRole("img", { name: `Cover not available: ${book.title}` });
    expect(cover).not.toHaveTextContent(book.title);
    expect(within(cover).getByText("A")).toBeInTheDocument();
    expect(screen.getAllByText(book.title)).toHaveLength(1);
    expect(screen.getByRole("heading", { name: book.title })).toHaveAttribute("title", book.title);
  });
  it("replaces a broken image with the identifiable monogram", () => {
    render(<CatalogueCover book={{ ...book, image_url: "/broken.jpg" }} />);
    fireEvent.error(screen.getByRole("img", { name: `Cover of ${book.title}` }));
    expect(screen.getByRole("img", { name: `Cover not available: ${book.title}` })).toHaveTextContent("EUC LIBRARY");
  });
});
