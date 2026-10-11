import { forwardRef } from "react";
import {
  BookOpen as OriginalBookOpen, BookMarked as OriginalBookMarked, CalendarDays as OriginalCalendarDays,
  Bell as OriginalBell, Search as OriginalSearch, Heart as OriginalHeart, MessageCircle as OriginalMessageCircle,
  Users as OriginalUsers, Database as OriginalDatabase, Archive as OriginalArchive,
  Sparkles as OriginalSparkles, BrainCircuit as OriginalBrainCircuit, Shield as OriginalShield,
  Barcode as OriginalBarcode, Lock as OriginalLock, Pencil as OriginalPencil, GripVertical as OriginalGripVertical,
  ClipboardList as OriginalClipboardList, FileText as OriginalFileText, BarChart3 as OriginalBarChart3,
  QrCode as OriginalQrCode, Download as OriginalDownload, Upload as OriginalUpload, Filter as OriginalFilter, Send as OriginalSend, Clock as OriginalClock, Hourglass as OriginalHourglass, ArrowRight as OriginalArrowRight, ChevronRight as OriginalChevronRight, Copy as OriginalCopy,
  type LucideIcon, type LucideProps,
} from "lucide-react";
import { LibraryIcon } from "./library-icon";
import { useLibraryDesign } from "./library-design";

// Utility glyphs retain their familiar meaning; domain glyphs share the library drawings.
export * from "lucide-react";
function glyph(name: string, Original: LucideIcon) {
  const Glyph = forwardRef<SVGSVGElement, LucideProps>(({ size = 24, absoluteStrokeWidth, ...props }, ref) => {
    const classSize = props.className?.match(/(?:^|\s)(?:size|h|w)-(3\.5|3|4)(?:\s|$)/);
    const enabled = useLibraryDesign();
    return enabled ? <LibraryIcon ref={ref} name={name} width={size} height={size} data-size={Number(size) <= 16 || classSize ? "small" : undefined} {...props} />
      : <Original ref={ref} size={size} absoluteStrokeWidth={absoluteStrokeWidth} {...props} />;
  });
  Glyph.displayName = `Library${name}`;
  return Glyph;
}
export const BookOpen = glyph("borrow", OriginalBookOpen);
export const BookMarked = glyph("catalog", OriginalBookMarked);
export const CalendarDays = glyph("academic", OriginalCalendarDays);
export const Bell = glyph("notifications", OriginalBell);
export const Search = glyph("search", OriginalSearch);
export const Heart = glyph("like", OriginalHeart);
export const MessageCircle = glyph("comment", OriginalMessageCircle);
export const Users = glyph("users", OriginalUsers);
export const Database = glyph("records", OriginalDatabase);
export const Archive = glyph("backup", OriginalArchive);
export const Sparkles = glyph("similar", OriginalSparkles);
export const BrainCircuit = glyph("similar", OriginalBrainCircuit);
export const Shield = glyph("auth", OriginalShield);
export const ClipboardList = glyph("records", OriginalClipboardList);
export const FileText = glyph("reports", OriginalFileText);
export const BarChart3 = glyph("analytics", OriginalBarChart3);

export const QrCode = glyph("qr", OriginalQrCode);
export const Download = glyph("export", OriginalDownload);
export const Upload = glyph("import", OriginalUpload);
export const Filter = glyph("filters", OriginalFilter);
export const Send = glyph("publish", OriginalSend);
export const Clock = glyph("pending", OriginalClock);
export const Hourglass = glyph("expiring", OriginalHourglass);
export const ArrowRight = glyph("arrow", OriginalArrowRight);
export const ChevronRight = glyph("chev", OriginalChevronRight);
export const Copy = glyph("copy", OriginalCopy);
export const Barcode = glyph("barcode", OriginalBarcode);
export const Lock = glyph("lock", OriginalLock);
export const Pencil = glyph("edit", OriginalPencil);
export const GripVertical = glyph("grip", OriginalGripVertical);
