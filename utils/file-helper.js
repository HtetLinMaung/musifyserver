const fs = require("fs");
const path = require("path");
const logger = require("./logger");

exports.rootPath = path.join(__dirname, "../");

exports.publicPath = path.join(__dirname, "../public");

exports.musicPath = path.join(__dirname, "../public/musics");

exports.deleteFile = (filePath) => {
  fs.unlink(filePath, (err) => {
    if (err) {
      logger.error(err.message);
    }
  });
};
