const express = require("express");
const {
  SERVER_ERROR,
  CREATED,
  OK,
} = require("../constants/response-constants");
const logger = require("../utils/logger");
const multer = require("multer");
const path = require("path");
const youtube = require("youtube-audio-stream");
const fs = require("fs");

const router = express.Router();

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, "..", "storage/public"));
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    // get multer file extension
    const extension = file.mimetype.split("/")[1];
    cb(
      null,
      file.originalname.split(".")[0] + "-" + uniqueSuffix + "." + extension
    );
  },
});

const storage2 = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, "..", "storage/musics"));
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    // get multer file extension
    const extension = file.mimetype.split("/")[1];
    cb(
      null,
      file.originalname.split(".")[0] + "-" + uniqueSuffix + "." + extension
    );
  },
});
const upload_public = multer({ storage });
const upload_song = multer({ storage: storage2 });

router.post("/upload-as-public", upload_public.single("file"), (req, res) => {
  try {
    logger.info("Uploading file");
    logger.info(`Multer file: ${JSON.stringify(req.file, null, 2)}`);

    const fileUrl = `/musifyserver/${req.file.filename}`;

    res.status(CREATED.code).json({ ...CREATED, fileUrl });
  } catch (err) {
    logger.error(err);
    res.status(SERVER_ERROR.code).json(SERVER_ERROR);
  }
});

router.get("/youtube-to-song", (req, res) => {
  try {
    // youtube to mp3
    const stream = youtube(req.query.url);
    // write stream to file
    const filename =
      req.query.filename || req.query.url.split("/").pop() + ".mp3";
    const file = fs.createWriteStream(
      path.join(__dirname, "..", "storage/musics", filename)
    );
    stream.pipe(file);
    res.json({ ...OK, fileUrl: `/storage/musics/${filename}` });
  } catch (err) {
    logger.error(err);
    res.status(SERVER_ERROR.code).json(SERVER_ERROR);
  }
});

router.post("/upload-song", upload_song.single("file"), (req, res) => {
  try {
    logger.info("Uploading file");
    logger.info(`Multer file: ${JSON.stringify(req.file, null, 2)}`);

    const fileUrl = `/storage/musics/${req.file.filename}`;

    res.status(CREATED.code).json({ ...CREATED, fileUrl });
  } catch (err) {
    logger.error(err);
    res.status(SERVER_ERROR.code).json(SERVER_ERROR);
  }
});

module.exports = router;
