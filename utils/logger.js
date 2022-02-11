const path = require("path");
const moment = require("moment");
const fs = require("fs");

const writeLogToFile = (message, level) => {
  const logFolder = path.join(__dirname, "..", "logs");
  if (!fs.existsSync(logFolder)) {
    fs.mkdirSync(logFolder);
  }
  const filePath = path.join(
    __dirname,
    "..",
    "logs",
    `${moment().format("YYYY-MM-DD")}.txt`
  );
  if (fs.existsSync(filePath)) {
    fs.appendFileSync(
      filePath,
      `[${moment().format("HH:mm:ss")}] [${level}] ${message}\n`
    );
  } else {
    fs.writeFileSync(filePath, `${moment().format("HH:mm:ss")} - ${message}\n`);
  }
};

const logger = {
  info: (message) => {
    console.log(message);
    writeLogToFile(message, "INFO");
  },
  error: (message) => {
    console.error(message);
    writeLogToFile(message, "ERROR");
  },
};

module.exports = logger;
