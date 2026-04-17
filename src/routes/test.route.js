const express = require("express");
const { testHandler } = require("../controllers/test.controller");

const router = express.Router();

router.get("/", testHandler);

module.exports = router;
