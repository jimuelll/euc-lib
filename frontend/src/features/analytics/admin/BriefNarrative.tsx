import type { ReactNode } from 'react';

export type BriefBlock = { kind: 'heading'; text: string } | { kind: 'list'; ordered: boolean; items: string[] } | { kind: 'paragraph'; lines: string[] };

// Saved briefs from before headings were normalized may use bare heading lines.
const LEGACY_HEADING = /^(?:\*\*)?(Performance assessment|What changed|Key findings|Recommended follow-up|Summary)(?:\*\*)?:?$/i;
const BULLET = /^\s*[-*•]\s+/, NUMBERED = /^\s*\d+[.)]\s+/;

/** Parses the Markdown subset AI briefs use: headings, bullet and numbered lists, paragraphs and **bold**. */
export function parseBrief(text: string): BriefBlock[] {
    const blocks: BriefBlock[] = [];
    for (const raw of text.replace(/\r\n?/g, '\n').split('\n')) {
        const line = raw.trim(), last = blocks[blocks.length - 1];
        if (!line) { blocks.push({ kind: 'paragraph', lines: [] }); continue; }
        if (/^#{1,6}\s+/.test(line) || LEGACY_HEADING.test(line)) { blocks.push({ kind: 'heading', text: line.replace(/^#{1,6}\s+/, '').replace(/\*\*/g, '').replace(/:$/, '') }); continue; }
        const ordered = NUMBERED.test(line);
        if (ordered || BULLET.test(line)) {
            const item = line.replace(ordered ? NUMBERED : BULLET, '');
            if (last?.kind === 'list' && last.ordered === ordered) last.items.push(item);
            else blocks.push({ kind: 'list', ordered, items: [item] });
            continue;
        }
        if (last?.kind === 'paragraph') last.lines.push(line);
        else blocks.push({ kind: 'paragraph', lines: [line] });
    }
    return blocks.filter(block => block.kind !== 'paragraph' || block.lines.length > 0);
}

/** Bold markers, plus peso amounts and numbers when `figures` is set, as the on-screen brief does. */
function inline(value: string, figures: boolean): ReactNode[] {
    const pattern = figures ? /(\*\*[^*]+\*\*|₱[\d,.]+|\b\d[\d,.]*\b)/g : /(\*\*[^*]+\*\*)/g;
    return value.split(pattern).filter(Boolean).map((part, index) => /^\*\*/.test(part) || (figures && /^(?:₱|\d)/.test(part)) ? <strong key={index}>{part.replace(/\*\*/g, '')}</strong> : part);
}

export function BriefNarrative({ text, figures = true }: { text: string; figures?: boolean }) {
    const sections: Array<{ heading?: string; blocks: BriefBlock[] }> = [];
    for (const block of parseBrief(text)) {
        if (block.kind === 'heading' || !sections.length) sections.push({ heading: block.kind === 'heading' ? block.text : undefined, blocks: [] });
        if (block.kind !== 'heading') sections[sections.length - 1].blocks.push(block);
    }
    return <div className="analytics-narrative">{sections.map((section, index) => <section key={index}>{section.heading && <h3>{section.heading}</h3>}{section.blocks.map((block, i) => block.kind === 'list'
        ? (block.ordered ? <ol key={i}>{block.items.map((item, j) => <li key={j}>{inline(item, figures)}</li>)}</ol> : <ul key={i}>{block.items.map((item, j) => <li key={j}>{inline(item, figures)}</li>)}</ul>)
        : block.kind === 'paragraph' && <p key={i}>{block.lines.map((line, j) => <span key={j}>{inline(line, figures)}{j < block.lines.length - 1 && <br />}</span>)}</p>)}</section>)}</div>;
}

/** Print-view HTML for a brief; `escape` is applied before any markup is added. */
export function briefHtml(text: string, escape: (value: string) => string): string {
    const bold = (value: string) => escape(value).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    return parseBrief(text).map(block => block.kind === 'heading' ? `<h2>${bold(block.text)}</h2>`
        : block.kind === 'list' ? `<${block.ordered ? 'ol' : 'ul'}>${block.items.map(item => `<li>${bold(item)}</li>`).join('')}</${block.ordered ? 'ol' : 'ul'}>`
            : `<p>${block.lines.map(bold).join('<br>')}</p>`).join('');
}
