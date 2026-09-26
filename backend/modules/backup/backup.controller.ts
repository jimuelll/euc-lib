import { gzipSync } from "node:zlib";
import type { Request, RequestHandler, Response } from "express";
import repository = require("./backup.repository");
import transforms = require("./snapshot.transforms");
import snapshot = require("./snapshot.service");
import storage = require("./snapshot.storage.service");
import restore = require("./snapshot.restore.service");
import type { AuthTokenPayload } from "../auth/auth.types";

const { logError } = require("../../logger") as { logError: (...values: unknown[]) => void };

type AuthenticatedRequest = Request & { user?: AuthTokenPayload };
type RequestError = { status?: number; message?: string };

const importLimit = (): number => Number(process.env.BACKUP_MAX_BYTES || 50 * 1024 * 1024);

function requireRestoreSignOutAcknowledgement(req: Request): void {
  if (req.get("x-restore-confirmation") !== "global-sign-out") {
    throw Object.assign(new Error("Restore confirmation is required: this operation signs out every user, including the restorer."), { status: 400 });
  }
}

function sendError(res: Response, error: unknown, fallback: string): void {
  logError("[backup]", error);
  const requestError = error as RequestError;
  res.status(requestError?.status || 500).json({ message: requestError?.message || fallback });
}

const exportBackup: RequestHandler = async (_req, res) => {
  try {
    const backup = await snapshot.createBackupPayload();
    const { contents } = storage.serializeSnapshot(backup);
    const filename = `euc-library-backup-${backup.createdAt.replace(/[:.]/g, "-")}.json.gz`;
    res.setHeader("Content-Type", "application/gzip");
    res.setHeader("Content-Disposition", `attachment; filename=\"${filename}\"`);
    res.send(gzipSync(contents));
  } catch (error: unknown) {
    sendError(res, error, "Could not create the database backup.");
  }
};

const listSavedSnapshots: RequestHandler = async (_req, res) => {
  try {
    res.json({ snapshots: await repository.listSnapshots() });
  } catch (error: unknown) {
    sendError(res, error, "Could not load saved snapshots.");
  }
};

const backupStatus: RequestHandler = async (_req, res) => {
  try {
    const state = await repository.getMaintenanceStatus();
    res.json({ mode: state.mode ?? "normal", startedAt: state.startedAt ?? null, snapshotVersion: transforms.SNAPSHOT_VERSION, maxImportBytes: importLimit() });
  } catch (error: unknown) {
    sendError(res, error, "Backup maintenance state is unavailable.");
  }
};

const checkCompatibility: RequestHandler = async (req, res) => {
  try {
    res.json(await snapshot.compatibilityFor(req.body));
  } catch (error: unknown) {
    sendError(res, error, "Could not verify snapshot compatibility.");
  }
};

const checkSavedCompatibility: RequestHandler = async (req, res) => {
  try {
    const savedSnapshot = await repository.findSnapshot(String(req.params.id));
    res.json(await snapshot.compatibilityFor(await storage.getSnapshotPayload(savedSnapshot)));
  } catch (error: unknown) {
    const requestError = error as RequestError;
    res.status(requestError?.status || 500).json({ compatible: false, message: requestError?.message || "Could not verify snapshot compatibility." });
  }
};

const saveSnapshot: RequestHandler = async (req, res) => {
  try {
    const user = (req as AuthenticatedRequest).user!;
    res.status(201).json({
      snapshot: await storage.uploadSnapshot(await snapshot.createBackupPayload(), user.id, "manual"),
      message: "Snapshot saved securely.",
    });
  } catch (error: unknown) {
    sendError(res, error, "Could not save the snapshot.");
  }
};

const downloadSnapshot: RequestHandler = async (req, res) => {
  try {
    const savedSnapshot = await repository.findSnapshot(String(req.params.id));
    const payload = await storage.getSnapshotPayload(savedSnapshot);
    res.setHeader("Content-Type", "application/gzip");
    res.setHeader("Content-Disposition", `attachment; filename=\"${savedSnapshot.filename.replace(/\.json$/i, ".json.gz")}\"`);
    res.send(gzipSync(JSON.stringify(payload)));
  } catch (error: unknown) {
    sendError(res, error, "Could not download the snapshot.");
  }
};

const restoreSavedSnapshot: RequestHandler = async (req, res) => {
  try {
    requireRestoreSignOutAcknowledgement(req);
    const savedSnapshot = await repository.findSnapshot(String(req.params.id));
    const backup = await storage.getSnapshotPayload(savedSnapshot);
    if (!transforms.validateBackup(backup)) throw Object.assign(new Error("The saved snapshot is invalid."), { status: 400 });
    const user = (req as AuthenticatedRequest).user!;
    const preRestoreSnapshot = await restore.performRestore(backup, {
      restoredBy: user.id,
      restoredByName: user.name,
      restoredByRole: user.role,
      snapshotId: savedSnapshot.id,
      snapshotKind: savedSnapshot.kind,
      snapshotLabel: `saved snapshot “${savedSnapshot.filename}”`,
    });
    // The restore transaction inserts its audit event before commit. Tell the
    // generic response logger not to append a second, post-restore event.
    res.locals.auditEnqueued = true;
    res.json({ message: "Database restored successfully.", preRestoreSnapshot });
  } catch (error: unknown) {
    sendError(res, error, "Restore failed before any database records were changed.");
  }
};

const restoreUploadedSnapshot: RequestHandler = async (req, res) => {
  try {
    requireRestoreSignOutAcknowledgement(req);
    if (!transforms.validateBackup(req.body)) throw Object.assign(new Error("This file is not a valid EUC Library backup."), { status: 400 });
    const user = (req as AuthenticatedRequest).user!;
    const preRestoreSnapshot = await restore.performRestore(req.body, {
      restoredBy: user.id,
      restoredByName: user.name,
      restoredByRole: user.role,
      snapshotLabel: "uploaded snapshot",
    });
    // performRestore commits a durable audit row as part of the data restore.
    res.locals.auditEnqueued = true;
    res.json({ message: "Database restored successfully.", restoredAt: new Date().toISOString(), preRestoreSnapshot });
  } catch (error: unknown) {
    sendError(res, error, "Restore failed before any database records were changed.");
  }
};

export = {
  exportBackup,
  listSavedSnapshots,
  backupStatus,
  checkCompatibility,
  checkSavedCompatibility,
  saveSnapshot,
  downloadSnapshot,
  restoreSavedSnapshot,
  restoreUploadedSnapshot,
};
