import { useRef, useState } from "react";
import type { AboutSettings, LibrarySpace } from "../api/about.service";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { LibraryDesignProvider } from "@/components/ui/library-design";

export default function SpacesGrid({ spaces }: { spaces: AboutSettings["spaces"] }) {
  const [selected, setSelected] = useState<LibrarySpace | null>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  if (!spaces.length) return null;
  return <section className="library-about-chapter" id="about-spaces" aria-labelledby="about-spaces-title">
    <div className="library-information-kicker">Library spaces</div><h2 className="library-information-section-title" id="about-spaces-title">Our facilities</h2>
    <div className="library-about-facilities">{spaces.map((space, index) => <button type="button" className="library-about-facility" key={space.name + index} onClick={(event) => { trigger.current = event.currentTarget; setSelected(space); }} aria-label={`View ${space.name}`}>
      <div className="library-about-facility-image">{space.image_url && <img src={space.image_url} alt={space.image_alt ?? space.name} loading="lazy" />}</div>
      <div className="library-about-facility-copy"><b>{space.name}</b><p>{space.description}</p></div>
    </button>)}</div>
    <LibraryDesignProvider><Dialog open={!!selected} onOpenChange={(open) => { if (!open) setSelected(null); }}>
      <DialogContent hideClose data-library-ui="facility-preview" className="library-facility-dialog" onCloseAutoFocus={(event) => { event.preventDefault(); trigger.current?.focus(); }}>
        {selected && <><div className="library-facility-dialog-image">{selected.image_url && <img src={selected.image_url} alt={selected.image_alt ?? selected.name} />}</div>
          <div className="library-facility-dialog-copy"><DialogClose className="library-facility-dialog-close">Close</DialogClose><DialogTitle>{selected.name}</DialogTitle><DialogDescription>{selected.description}</DialogDescription></div></>}
      </DialogContent>
    </Dialog></LibraryDesignProvider>
  </section>;
}
