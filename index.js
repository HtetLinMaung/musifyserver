require("dotenv").config();
const express = require("express");
const cors = require("cors");
const youtube = require("youtube-audio-stream");
const fs = require("fs");
const logger = require("./utils/logger");
const mongoose = require("mongoose");
const betterLogging = require("better-logging");

betterLogging(console);

const PORT = process.env.PORT || 3000;

const app = express();

app.use("/musifyserver", express.static("storage/public"));
app.use(cors());
app.use(express.json());

app.use("/musifyserver/storage", require("./routes/storage-route"));
app.use("/musifyserver/artists", require("./routes/artist-route"));
app.use("/musifyserver/albums", require("./routes/album-route"));
app.use("/musifyserver/songs", require("./routes/song-route"));
app.use("/musifyserver/categories", require("./routes/category-route"));

app.get("/stream", (req, res) => {
  const music = "storage/musics/music.mp3"; // filepath
  const stat = fs.statSync(music);
  const range = req.headers.range;
  let readStream;
  // if there is no request about range
  if (range) {
    // remove 'bytes=' and split the string by '-'
    const parts = range.replace(/bytes=/, "").split("-");

    const partial_start = parts[0];
    const partial_end = parts[1];

    if (
      (isNaN(partial_start) && partial_start.length > 1) ||
      (isNaN(partial_end) && partial_end.length > 1)
    ) {
      return res.sendStatus(500);
    }
    // convert string to integer (start)
    const start = parseInt(partial_start, 10);
    // convert string to integer (end)
    // if partial_end doesn't exist, end equals whole file size - 1
    const end = partial_end ? parseInt(partial_end, 10) : stat.size - 1;
    // content length
    const content_length = end - start + 1;

    res.status(206).header({
      "Content-Type": "audio/mpeg",
      "Content-Length": content_length,
      "Content-Range": "bytes " + start + "-" + end + "/" + stat.size,
    });

    // Read the stream of starting & ending part
    readStream = fs.createReadStream(music, { start, end });
  } else {
    res.header({
      "Content-Type": "audio/mpeg",
      "Content-Length": stat.size,
    });
    readStream = fs.createReadStream(music);
  }
  readStream.pipe(res);
});

app.get("/youtube-to-mp3", (req, res) => {
  // youtube to mp3
  const stream = youtube(req.query.url);
  // write stream to file
  const file = fs.createWriteStream("storage/musics/music.mp3");
  stream.pipe(file);
  res.json({ message: "success" });
});

mongoose
  .connect(process.env.DB_CONNECTION)
  .then(() => {
    app.listen(PORT, () => {
      logger.info(`Server listening on port ${PORT}`);
    });
  })
  .catch(logger.error);
