const express = require("express");
const logger = require("../utils/logger");

const router = express.Router();

const ListenNow = require("../models/ListenNow");
const { OK, SERVER_ERROR } = require("../constants/response-constants");

router.get("/listen-now", async (req, res) => {
  try {
    logger.info("Getting listen now");
    const data = await ListenNow.find().populate(["category"]);
    const response = { ...OK, data };
    res.json(response);
    SERVER_ERROR;
  } catch (err) {
    logger.error(err.message);
    res.status(SERVER_ERROR.code).json(SERVER_ERROR);
  }
});

module.exports = router;
