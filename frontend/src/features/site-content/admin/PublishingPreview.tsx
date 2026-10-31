import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import type { ContentPayload, ContentSection } from "../publishing.service";
import type { PreviewSnapshot } from "./preview-data";

export default function PublishingPreview({ open, onClose, section, value, documents }: {
  open: boolean; onClose: () => void; section: ContentSection; value: ContentPayload;
  documents?: PreviewSnapshot["documents"];
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const { user, getToken } = useAuth();
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [ready, setReady] = useState(false);
  const snapshot: PreviewSnapshot = { section, documents: { ...documents, [section]: value }, user, token: getToken() };
  const latest = useRef(snapshot);
  latest.current = snapshot;
  useEffect(() => {
    if (!open) { setReady(false); return; }
    const receive = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== frame.current?.contentWindow || event.data?.type !== "content-preview-ready") return;
      frame.current.contentWindow?.postMessage({ type: "content-preview-data", snapshot: latest.current }, window.location.origin);
      setReady(true);
    };
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, [open]);
  useEffect(() => {
    if (open && ready) frame.current?.contentWindow?.postMessage({ type: "content-preview-data", snapshot: latest.current }, window.location.origin);
  }, [open, ready, section, value, documents, user]);
  return <Dialog open={open} onOpenChange={next => { if (!next) onClose(); }}>
    <DialogContent className="publishing-preview">
      <DialogHeader><DialogTitle>Draft preview</DialogTitle><DialogDescription>The actual page with your current edits. Changes stay private; saving actions are disabled here.</DialogDescription></DialogHeader>
      <div className="publishing-preview-toolbar">
        <div role="group" aria-label="Preview viewport">
          <Button variant={device === "desktop" ? "default" : "outline"} size="sm" aria-pressed={device === "desktop"} onClick={() => setDevice("desktop")}>Desktop</Button>
          <Button variant={device === "mobile" ? "default" : "outline"} size="sm" aria-pressed={device === "mobile"} onClick={() => setDevice("mobile")}>Mobile</Button>
        </div>
      </div>
      <div className="publishing-preview-stage" data-device={device}>
        {!ready && <p className="publishing-preview-loading" role="status">Loading page preview…</p>}
        <iframe ref={frame} src="/?__content_preview=1" title={`${section} draft preview`} className="publishing-preview-frame" />
      </div>
    </DialogContent>
  </Dialog>;
}
