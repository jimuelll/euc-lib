import { createContext, useContext, type ReactNode } from "react";

/** React context follows portals; the DOM scope carries the matching color tokens. */
const LibraryDesignContext = createContext(false);

export function LibraryDesignProvider({ children, enabled = true }: { children: ReactNode; enabled?: boolean }) {
  return <LibraryDesignContext.Provider value={enabled}>{children}</LibraryDesignContext.Provider>;
}

export function useLibraryDesign() {
  return useContext(LibraryDesignContext);
}
