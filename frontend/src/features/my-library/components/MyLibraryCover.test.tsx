// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import MyLibraryCover from "./MyLibraryCover";

afterEach(cleanup);

describe("library covers", () => {
  it("uses the existing placeholder for the material when no cover is available", () => {
    const { rerender } = render(<MyLibraryCover title="Book" />);
    expect(screen.getByRole("img").getAttribute("src")).toBe(
      "/book-cover-fallback.svg",
    );
    rerender(<MyLibraryCover title="Thesis" material_type="thesis" />);
    expect(screen.getByRole("img").getAttribute("src")).toBe(
      "/thesis-cover-fallback.svg",
    );
  });

  it("falls back on broken covers and tries a replacement URL", () => {
    const { rerender } = render(
      <MyLibraryCover
        title="Research"
        image_url="/broken.jpg"
        material_type="thesis"
      />,
    );
    fireEvent.error(screen.getByRole("img", { name: "Cover of Research" }));
    expect(screen.getByRole("img").getAttribute("src")).toBe(
      "/thesis-cover-fallback.svg",
    );
    rerender(
      <MyLibraryCover
        title="Research"
        image_url="/replacement.jpg"
        material_type="thesis"
      />,
    );
    expect(
      screen
        .getByRole("img", { name: "Cover of Research" })
        .getAttribute("src"),
    ).toBe("/replacement.jpg");
  });
});
