const router = require("express").Router();
const controller = require("./recommendations.controller");
router.get("/catalogue/books/:bookId/recommendations", controller.forBook);
module.exports = router;
