import { useCallback, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { AdminIcon } from "@/features/admin";
import type { GuideRegion, GuideScreen } from "../guide-content";

// Wireframe of a page with numbered pins. With room, callouts sit on both sides of the frame and
// an arrow runs from each callout to its pin. Narrower, the callouts move below the frame and the
// arrow for a callout appears while it is hovered or focused.

type Layout = "beside" | "below";
const BESIDE_AT = 1040;
const sectionNames = new Set(["Desk", "Records", "Publishing", "Insights", "Settings"]);

interface Placed { number: number; region: GuideRegion; title: string; body: string; side: "left" | "right"; row: number; col: number }

function regionBounds(areas: string[], id: string) {
  const rows = areas.map(row => row.trim().split(/\s+/));
  let top = Infinity, left = Infinity, right = -1;
  rows.forEach((cells, rowIndex) => cells.forEach((cell, colIndex) => {
    if (cell !== id) return;
    top = Math.min(top, rowIndex); left = Math.min(left, colIndex); right = Math.max(right, colIndex);
  }));
  const columns = rows[0]?.length || 1;
  return { row: top, col: left, center: (left + right + 1) / 2 / columns };
}

export function GuideScreenMap({ screen }: { screen: GuideScreen }) {
  const labelId = `guide-map-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const stageRef = useRef<HTMLDivElement>(null);
  const pins = useRef(new Map<number, HTMLSpanElement>());
  const cards = useRef(new Map<number, HTMLLIElement>());
  const [layout, setLayout] = useState<Layout>("beside");
  const [paths, setPaths] = useState<{ number: number; d: string }[]>([]);
  const [active, setActive] = useState<number | null>(null);
  const beside = layout === "beside";

  const placed = useMemo<Placed[]>(() => {
    const regions = new Map(screen.regions.map(region => [region.id, region]));
    return screen.callouts
      .flatMap(callout => {
        const region = regions.get(callout.region);
        if (!region) return [];
        const bounds = regionBounds(screen.areas, region.id);
        return [{ ...callout, region, row: bounds.row, col: bounds.col, side: bounds.center < 0.5 ? "left" as const : "right" as const }];
      })
      .sort((a, b) => a.row - b.row || a.col - b.col)
      .map((item, index) => ({ ...item, number: index + 1 }));
  }, [screen]);
  const pinsByRegion = useMemo(() => {
    const map = new Map<string, Placed[]>();
    placed.forEach(item => map.set(item.region.id, [...(map.get(item.region.id) ?? []), item]));
    return map;
  }, [placed]);

  const measure = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const nextLayout: Layout = stage.clientWidth >= BESIDE_AT ? "beside" : "below";
    setLayout(nextLayout);
    if (nextLayout !== layout) { setPaths([]); return; }
    const origin = stage.getBoundingClientRect();
    setPaths(placed.flatMap(item => {
      const pin = pins.current.get(item.number)?.getBoundingClientRect();
      const card = cards.current.get(item.number)?.getBoundingClientRect();
      if (!pin || !card) return [];
      if (layout === "below") {
        const fromX = card.left + 23 - origin.left, fromY = card.top - origin.top;
        const toX = pin.left + pin.width / 2 - origin.left, toY = pin.bottom - origin.top;
        const bend = Math.max(30, (fromY - toY) * 0.5);
        return [{ number: item.number, d: `M${fromX},${fromY} C${fromX},${fromY - bend} ${toX},${toY + bend} ${toX},${toY}` }];
      }
      const fromX = (item.side === "left" ? card.right : card.left) - origin.left;
      const fromY = card.top + 18 - origin.top;
      const toX = (item.side === "left" ? pin.left : pin.right) - origin.left;
      const toY = pin.top + pin.height / 2 - origin.top;
      const bend = Math.max(24, Math.abs(toX - fromX) * 0.45) * (item.side === "left" ? 1 : -1);
      return [{ number: item.number, d: `M${fromX},${fromY} C${fromX + bend},${fromY} ${toX - bend},${toY} ${toX},${toY}` }];
    }));
  }, [placed, layout]);

  useLayoutEffect(() => {
    measure();
    const stage = stageRef.current;
    if (!stage || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => measure());
    observer.observe(stage);
    return () => observer.disconnect();
  }, [measure]);

  const card = (item: Placed) => <li
    key={item.number}
    ref={node => { if (node) cards.current.set(item.number, node); else cards.current.delete(item.number); }}
    className="guide-callout"
    data-active={active === item.number || undefined}
    tabIndex={0}
    onMouseEnter={() => setActive(item.number)}
    onMouseLeave={() => setActive(null)}
    onFocus={() => setActive(item.number)}
    onBlur={() => setActive(null)}
  >
    <span className="guide-callout-number" aria-hidden="true">{item.number}</span>
    <div><strong><span className="sr-only">{item.number}. </span>{item.title}</strong><p>{item.body}</p></div>
  </li>;
  const activeRegion = placed.find(item => item.number === active)?.region.id;
  const visiblePaths = beside ? paths : paths.filter(path => path.number === active);

  return <figure className="guide-map" aria-labelledby={labelId}>
    <figcaption id={labelId}><strong>{screen.title}</strong><span>{screen.caption}</span></figcaption>
    <div ref={stageRef} className="guide-map-stage" data-layout={layout}>
      {beside && <ol className="guide-callouts" data-side="left" aria-label={`${screen.title} callouts, left`}>{placed.filter(item => item.side === "left").map(card)}</ol>}
      <div className="guide-frame-scroll" onScroll={measure}>
        <div className="guide-frame" aria-hidden="true" style={{ gridTemplateColumns: screen.columns, gridTemplateAreas: screen.areas.map(row => `"${row}"`).join(" ") }}>
          {screen.regions.map(region => <div key={region.id} className="guide-region" data-kind={region.kind} data-tone={region.tone} data-active={activeRegion === region.id || undefined} style={{ gridArea: region.id }}>
            <RegionMock region={region} />
            {(pinsByRegion.get(region.id) ?? []).map((item, index) => <span
              key={item.number}
              ref={node => { if (node) pins.current.set(item.number, node); else pins.current.delete(item.number); }}
              className="guide-pin"
              data-side={beside ? item.side : "corner"}
              data-active={active === item.number || undefined}
              style={{ "--pin-offset": `${index * 30}px` } as CSSProperties}
              onMouseEnter={() => setActive(item.number)}
              onMouseLeave={() => setActive(null)}
            >{item.number}</span>)}
          </div>)}
        </div>
      </div>
      <ol className="guide-callouts" data-side={beside ? "right" : "below"} aria-label={beside ? `${screen.title} callouts, right` : `${screen.title} callouts`}>
        {(beside ? placed.filter(item => item.side === "right") : placed).map(card)}
      </ol>
      <svg className="guide-arrows" aria-hidden="true">
        <defs>
          <marker id={`${labelId}-head`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="currentColor" /></marker>
        </defs>
        {visiblePaths.map(path => <path key={path.number} d={path.d} data-active={active === path.number || undefined} markerEnd={`url(#${labelId}-head)`} />)}
      </svg>
    </div>
  </figure>;
}

function Lines({ items }: { items?: string[] }) {
  return <>{items?.map(item => <span key={item} className="guide-mock-line">{item}</span>)}</>;
}

function RegionMock({ region }: { region: GuideRegion }): ReactNode {
  const { kind, label, items } = region;
  switch (kind) {
    case "sidebar":
      return <><span className="guide-mock-brand">{label}</span>{items?.map(item => <span key={item} className={sectionNames.has(item) ? "guide-mock-group" : "guide-mock-nav"}>{item}</span>)}</>;
    case "header":
      return <><span className="guide-mock-title-block"><span className="guide-mock-title">{label}</span><span className="guide-mock-help-dot">i</span></span><span className="guide-mock-buttons">{items?.map(item => <span key={item} className="guide-mock-button">{item}</span>)}</span></>;
    case "help":
      return <span className="guide-mock-help-dot">i</span>;
    case "tabs":
      return <span className="guide-mock-tabs">{items?.map((item, index) => <span key={item} data-selected={index === 0 || undefined}>{item}</span>)}</span>;
    case "chips":
      return <span className="guide-mock-chips">{items?.map((item, index) => <span key={item} data-selected={index === 0 || undefined}>{item}</span>)}</span>;
    case "tiles":
      return <span className="guide-mock-tiles">{items?.map(item => <span key={item}><span>{item}</span><i /></span>)}</span>;
    case "search":
      return <span className="guide-mock-search"><AdminIcon name="search" />{label}</span>;
    case "list":
      return <><span className="guide-mock-label">{label}</span><span className="guide-mock-columns">{items?.map(item => <span key={item}>{item}</span>)}</span>{[0, 1, 2].map(row => <span key={row} className="guide-mock-row"><i /><i /><i /></span>)}</>;
    case "button":
      return <span className="guide-mock-primary">{label}</span>;
    case "chart":
      return <><span className="guide-mock-label">{label}</span><span className="guide-mock-chart">{[40, 65, 52, 80, 58, 72, 46, 90, 62].map((height, index) => <i key={index} style={{ height: `${height}%` }} />)}</span></>;
    case "pill":
    case "topbar":
      return <span className="guide-mock-pill">{label}</span>;
    default:
      return <><span className="guide-mock-label">{label}</span><Lines items={items} /></>;
  }
}
