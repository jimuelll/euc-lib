const queryService = require("./query.service");
const reportService = require("./report.service");
const { formatQueryValue } = require("./query.format");

const respond = (handler) => async (req, res) => {
  try { res.json(await handler(req)); }
  catch (error) { res.status(error.status || 500).json({ message: error.message || "Unable to load query results." }); }
};

const escapeCsv = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;

exports.getMeta = respond(() => queryService.getQueryMeta());
exports.list = respond((req) => queryService.listQuery(req.query));
exports.exportCsv = async (req, res) => {
  try {
    const result = await queryService.exportQuery(req.query);
    if (req.query.format === "preview") return res.json(result);
    const lines = [result.columns.map((column) => escapeCsv(column.label)).join(","), ...result.rows.map((row) => result.columns.map((column) => escapeCsv(formatQueryValue(row[column.key], column.type))).join(","))];
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${result.dataset}-query.csv"`);
    res.send(`\uFEFF${lines.join("\r\n")}`);
  } catch (error) { res.status(error.status || 500).json({ message: error.message || "Unable to export query results." }); }
};

exports.listReport = respond((req) => reportService.listReport(req.query));
exports.exportReport = async (req, res) => {
  try {
    const result = await reportService.exportReport(req.query);
    if (req.query.format === "preview") return res.json(result);
    const lines = [result.columns.map((column) => escapeCsv(column.label)).join(","), ...result.rows.map((row) => result.columns.map((column) => escapeCsv(column.type === "number" ? row[column.key] : formatQueryValue(row[column.key], column.type))).join(","))];
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${result.report}-report.csv"`);
    res.send(`\uFEFF${lines.join("\r\n")}`);
  } catch (error) { res.status(error.status || 500).json({ message: error.message || "Unable to export report." }); }
};
