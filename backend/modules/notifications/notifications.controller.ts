import {uploadNotificationImage} from './notifications.image.service';
import type { Request, RequestHandler } from "express";
import service = require("./notifications.service");
import * as admin from './notifications.admin.service';
import logger = require("../../logger");
const { logError } = logger;
type AuthenticatedRequest = Request & {
    user: {
        id: number;
        role: string;
    };
};
type ServiceError = {
    status?: number;
    message?: string;
};
const searchAdminNotificationRecipients: RequestHandler = async (req, res) => {
    try {
        const query = String(req.query.q ?? "").trim();
        if (query.length < 2)
            return res.json({ recipients: [] });
        const recipients = await service.searchNotificationRecipients(query);
        res.json({ recipients });
    }
    catch (err) {
        logError("[notifications] searchAdminNotificationRecipients:", err);
        res.status(500).json({ message: "Failed to search accounts" });
    }
};
const listMyNotifications: RequestHandler = async (req, res) => {
    try {
        const limit = req.query.limit ? Number(req.query.limit) : undefined;
        const unreadOnly = req.query.unreadOnly === "true";
        const user = (req as AuthenticatedRequest).user;
        const rows = await service.listForUser({ userId: user.id, role: user.role, limit, unreadOnly });
        res.json(rows);
    }
    catch (err) {
        logError("[notifications] listMyNotifications:", err);
        res.status(500).json({ message: "Failed to fetch notifications" });
    }
};
const getUnreadCount: RequestHandler = async (req, res) => {
    try {
        const user = (req as AuthenticatedRequest).user;
        const unreadCount = await service.getUnreadCountForUser({ userId: user.id, role: user.role });
        res.json({ unreadCount });
    }
    catch (err) {
        logError("[notifications] getUnreadCount:", err);
        res.status(500).json({ message: "Failed to fetch unread count" });
    }
};
const markAsRead: RequestHandler = async (req, res) => {
    try {
        const notificationId = Number(req.params.notificationId);
        if (!notificationId)
            return res.status(400).json({ message: "Invalid notification ID" });
        const user = (req as AuthenticatedRequest).user;
        res.json(await service.markAsRead({ notificationId, userId: user.id, role: user.role }));
    }
    catch (err) {
        logError("[notifications] markAsRead:", err);
        const error = err as ServiceError;
        res.status(error.status ?? 500).json({ message: error.message ?? "Failed to mark notification as read" });
    }
};
const markAllAsRead: RequestHandler = async (req, res) => {
    try {
        const user = (req as AuthenticatedRequest).user;
        res.json(await service.markAllAsRead({ userId: user.id, role: user.role }));
    }
    catch (err) {
        logError("[notifications] markAllAsRead:", err);
        res.status(500).json({ message: "Failed to mark notifications as read" });
    }
};
const adminHandler = (work: (req: Request) => Promise<unknown>, status = 200): RequestHandler => async (req, res) => { try {
    res.set("Cache-Control","no-store");
    res.status(status).json(await work(req));
}
catch (error) {
    const failure = error as ServiceError;
    logError('[notifications] admin:', error);
    res.status(failure.status || 500).json({ message: failure.status ? failure.message : 'Could not update notifications.' });
} };
const createAdminNotification = adminHandler(req => admin.create(req.body, (req as AuthenticatedRequest).user.id), 201);
const listAdminNotifications = adminHandler(req => admin.list(req.query));
const countAdminRecipients = adminHandler(async (req) => ({ count: await admin.count(req.query) }));
const previewAdminEmail = adminHandler(req => admin.emailPreview(req.query));
const notificationDetails = adminHandler(req => admin.details(String(req.params.key)));
const notificationAction = adminHandler(req => admin.action(String(req.params.key), String(req.params.action), (req as AuthenticatedRequest).user.id, req.body));
const uploadImage=adminHandler(req=>uploadNotificationImage((req as Request & {file?:{buffer:Buffer;size:number;mimetype:string}}).file),201);
const getNotification=adminHandler(async req=>{const id=Number(req.params.notificationId);if(!Number.isSafeInteger(id)||id<1)throw Object.assign(new Error('Notification not found.'),{status:404});const user=(req as AuthenticatedRequest).user;const record=await service.getByIdForUser({notificationId:id,userId:user.id,role:user.role});if(!record)throw Object.assign(new Error('Notification not found.'),{status:404});return record;});
export = {uploadImage,getNotification,
    previewAdminEmail,
    countAdminRecipients,
    notificationDetails,
    notificationAction,
    searchAdminNotificationRecipients,
    listMyNotifications,
    getUnreadCount,
    markAsRead,
    markAllAsRead,
    createAdminNotification,
    listAdminNotifications,
};
