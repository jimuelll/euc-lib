import type { Request, RequestHandler } from 'express';
import queryService = require('./query.service');
import reportService = require('./report.service');
import queryFormat = require('./query.format');
import { selectedColumns, safeCsv, excelDocument, moneyKeys } from './query.output';
import { prepareExport } from './query.export.service';
type RequestError = {
    status?: number;
    message?: string;
};
const respond = (handler: (req: Request) => Promise<unknown>): RequestHandler => async (req, res) => { try {
    res.json(await handler(req));
}
catch (error) {
    const e = error as RequestError;
    res.status(e.status || 500).json({ message: e.message || 'Unable to load query results.' });
} };
const getMeta = respond(() => queryService.getQueryMeta());
const list = respond(req => queryService.listQuery(req.query));
const listReport = respond(req => reportService.listReport(req.query));
const exportHandler = (report: boolean): RequestHandler => async (req, res) => {
    try {
        const user = (req as Request & {
            user?: {
                id: number;
                role: string;
            };
        }).user;
        if (!user || !['admin', 'super_admin'].includes(user.role))
            return void res.status(403).json({ message: 'Only library administrators may export records.' });
        const format = String(req.query.format || 'csv');
        if (!['csv', 'excel', 'preview'].includes(format))
            throw Object.assign(new Error('Choose CSV, Excel or Print / PDF.'), { status: 400 });
        const result: any = report ? await reportService.exportReport(req.query) : await queryService.exportQuery(req.query);
        result.columns = selectedColumns(result.columns, req.query.columns);
        await prepareExport(result, req.query, user, format);
        if (format === 'preview')
            return void res.json(result);
        const name = (result.report || result.dataset) + (report ? '-report' : '-records');
        if (format === 'excel') {
            res.setHeader('Content-Type', 'application/vnd.ms-excel; charset=utf-8');
            res.setHeader('Content-Disposition', 'attachment; filename="' + name + '.xls"');
            return void res.send(excelDocument(result, result.metadata));
        }
        const cell = (row: any, column: any) => moneyKeys.has(column.key) ? new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(row[column.key] || 0)) : queryFormat.formatQueryValue(row[column.key], column.type);
        const lines = [result.columns.map((c: any) => safeCsv(c.label)).join(','), ...result.rows.map((row: any) => result.columns.map((c: any) => safeCsv(cell(row, c))).join(','))];
        if (result.totals)
            lines.push(result.columns.map((c: any, i: number) => safeCsv(c.key in result.totals ? cell(result.totals, c) : i === 0 ? 'Totals' : '')).join(','));
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="' + name + '.csv"');
        res.send('\uFEFF' + lines.join('\r\n'));
    }
    catch (error) {
        const e = error as RequestError;
        res.status(e.status || 500).json({ message: e.message || 'Unable to export results.' });
    }
};
const exportCsv = exportHandler(false), exportReport = exportHandler(true);
export = { getMeta, list, exportCsv, listReport, exportReport };
