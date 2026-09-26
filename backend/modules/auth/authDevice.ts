import type { Request } from "express";

type DeviceType = "desktop" | "mobile" | "tablet" | "unknown";

const DEVICE_TYPES: ReadonlySet<string> = new Set(["desktop", "mobile", "tablet", "unknown"]);

function getDeviceType(userAgent: unknown): DeviceType {
  if (!userAgent || typeof userAgent !== "string") return "unknown";

  const value = userAgent.toLowerCase();
  if (/ipad|tablet|(android(?!.*mobile))/.test(value)) return "tablet";
  if (/mobi|iphone|ipod|android|iemobile|opera mini|windows phone/.test(value)) return "mobile";
  return "desktop";
}

function getAuthAuditContext(req: Request): { deviceType: DeviceType } {
  return { deviceType: getDeviceType(req.get("user-agent")) };
}

function normalizeDeviceType(value: unknown): DeviceType {
  return typeof value === "string" && DEVICE_TYPES.has(value) ? value as DeviceType : "unknown";
}

export = { getAuthAuditContext, getDeviceType, normalizeDeviceType };
