const router = require("express").Router();
const controller = require("./recommendations.controller");
const { limiters } = require("../../middlewares/rateLimiter");
router.get("/catalogue/books/:bookId/recommendations", limiters.publicCatalogue, controller.forBook);
module.exports = router;
