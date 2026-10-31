const pesoFormatter = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const AMOUNT = String.raw`((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?)`;

export function formatPeso(value: string | number): string {
    return pesoFormatter.format(Number(String(value).replace(/,/g, '')));
}

/** Rewrites every currency spelling the model might use into ₱ with thousands separators and centavos. */
export function formatPesos(text: string): string {
    return text
        .replace(new RegExp(String.raw`\b${AMOUNT}\s*(?:USD|US dollars?|dollars?|PHP|Php|pesos?)\b`, 'gi'), (_, value) => formatPeso(value))
        .replace(new RegExp(String.raw`(?:\b(?:USD|PHP|Php)|\$)\s*${AMOUNT}`, 'gi'), (_, value) => formatPeso(value))
        .replace(new RegExp(String.raw`₱\s*${AMOUNT}`, 'g'), (_, value) => formatPeso(value));
}

const COMPARISON_NOTE = 'No prior data to compare.';
const PRIOR_PERIOD_CLAIM = /\b(previous|prior|growth|increas(?:e|ed|es|ing)|decreas(?:e|ed|es|ing)|grew|declin(?:e|ed|es|ing)|rose|fell|dropped|up from|down from)\b|(?:^|\s)[+-]\d|No prior data to compare/i;

/**
 * Final presentation rules. When no complete previous period exists, a brief
 * starts with the comparison note and loses any line that claims change
 * against an earlier period, so an unrecorded baseline can never surface.
 */
export function formatReport(text: string, comparisonAvailable: boolean, { mode = 'summary' }: { mode?: 'summary' | 'answer' } = {}): string {
    let result = formatPesos(text).trim();
    if (!comparisonAvailable && mode === 'summary') {
        const kept = result.split('\n').filter(line => !PRIOR_PERIOD_CLAIM.test(line)).join('\n').replace(/\n{3,}/g, '\n\n').trim();
        result = `${COMPARISON_NOTE}\n\n${kept}`;
    }
    return result.trim();
}
