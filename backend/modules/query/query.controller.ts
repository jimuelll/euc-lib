import type { Request, RequestHandler, Response } from "express";
import queryService = require("./query.service");
import reportService = require("./report.service");
import queryFormat = require("./query.format");

type RequestError = { status?: number; message?: string };
type CsvColumn = { key: string; label: string; type: string };
type CsvResult = {
  columns: CsvColumn[];
  rows: Array<Record<string, unknown>>;
  dataset?: string;
  report?: string;
};

const respond = (handler: (req: Request) => Promise<unknown>): RequestHandler => async (req, res) => {
  try {
    res.json(await handler(req));
  } catch (error: unknown) {
    const requestError = error as RequestError;
    res.status(requestError?.status || 500).json({ message: requestError?.message || "Unable to load query results." });
  }
};

const escapeCsv = (value: unknown): string => `"${String(value ?? "").replace(/"/g, '""')}"`;

const getMeta = respond(() => queryService.getQueryMeta());
const list = respond((req) => queryService.listQuery(req.query));

const exportCsv: RequestHandler = async (req, res) => {
  try {
    const result = await queryService.exportQuery(req.query) as CsvResult;
    if (req.query.format === "preview") return void res.json(result);
    const lines = [
      result.columns.map((column) => escapeCsv(column.label)).join(","),
      ...result.rows.map((row) => result.columns
        .map((column) => escapeCsv(queryFormat.formatQueryValue(row[column.key], column.type)))
        .join(",")),
    ];
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${result.dataset}-query.csv"`);
    res.send(`\uFEFF${lines.join("\r\n")}`);
  } catch (error: unknown) {
    const requestError = error as RequestError;
    res.status(requestError?.status || 500).json({ message: requestError?.message || "Unable to export query results." });
  }
};

const listReport = respond((req) => reportService.listReport(req.query));

const exportReport: RequestHandler = async (req, res) => {
  try {
    const result = await reportService.exportReport(req.query) as CsvResult;
    if (req.query.format === "preview") return void res.json(result);
    const lines = [
      result.columns.map((column) => escapeCsv(column.label)).join(","),
      ...result.rows.map((row) => result.columns
        .map((column) => escapeCsv(column.type === "number" ? row[column.key] : queryFormat.formatQueryValue(row[column.key], column.type)))
        .join(",")),
    ];
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${result.report}-report.csv"`);
    res.send(`\uFEFF${lines.join("\r\n")}`);
  } catch (error: unknown) {
    const requestError = error as RequestError;
    res.status(requestError?.status || 500).json({ message: requestError?.message || "Unable to export report." });
  }
};

export = { getMeta, list, exportCsv, listReport, exportReport };
