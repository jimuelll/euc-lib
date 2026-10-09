export function formatReport(text: string, comparisonAvailable: boolean) {
    const peso = (value: string) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 2 }).format(Number(value.replace(/,/g, '')));
    let result = text.replace(/\b(\d[\d,]*(?:\.\d{1,2})?)\s*(?:USD|US dollars?)\b/gi, (_, value) => peso(value)).replace(/\b(?:USD|PHP)\s*(\d[\d,]*(?:\.\d{1,2})?)/gi, (_, value) => peso(value)).replace(/₱\s*(\d[\d,]*(?:\.\d{1,2})?)/g, (_, value) => peso(value));
    if (!comparisonAvailable) {
        result = result.split('\n').filter(line => !/\b(previous|prior|growth|increas(?:e|ed)|decreas(?:e|ed))\b|\+\d+|No prior data to compare/i.test(line)).join('\n').trim();
        result = 'No prior data to compare.\n\n' + result;
    }
    return result.trim();
}
