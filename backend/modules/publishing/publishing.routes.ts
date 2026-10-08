import express = require("express");
import type { Request, RequestHandler } from "express";
import auth = require("../auth/auth.middleware");
import * as service from "./publishing.service";
const router = express.Router();
router.use(auth.authMiddleware(["admin", "super_admin"]));
const handle = (work: (req: Request) => Promise<unknown>): RequestHandler => async (req, res) => { try {
    res.json(await work(req));
}
catch (error) {
    const err = error as {
        status?: number;
        message?: string;
    };
    res.status(err.status || 500).json({ message: err.status ? err.message : "Could not complete the publishing action. Try again." });
} };
router.post("/publish-all",handle(req=>service.publishAll(req.body,(req as any).user.id)));
router.get("/", handle(() => service.list()));
router.get("/:section", handle(req => service.read(req.params.section)));
router.put("/:section/draft", handle(req => service.mutate(req.params.section, "draft", req.body, (req as any).user.id)));
router.post("/:section/publish", handle(req => service.mutate(req.params.section, "publish", req.body, (req as any).user.id)));
router.delete("/:section/draft", handle(req => service.mutate(req.params.section, "discard", req.body, (req as any).user.id)));
export = router;
