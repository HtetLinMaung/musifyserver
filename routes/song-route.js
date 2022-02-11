const express = require("express");
const {
  SERVER_ERROR,
  CREATED,
  NOT_FOUND,
  OK,
} = require("../constants/response-constants");
const Song = require("../models/Song");
const logger = require("../utils/logger");
const getMP3Duration = require("get-mp3-duration");
const fs = require("fs");
const Artist = require("../models/Artist");
const Album = require("../models/Album");
const Category = require("../models/Category");
const { queryToMongoFilter } = require("../utils/mongoose-utils");

const router = express.Router();

router
  .route("/")
  .post(async (req, res) => {
    try {
      logger.info("Creating song");
      logger.info(`Request body: ${JSON.stringify(req.body, null, 2)}`);
      const buffer = fs.readFileSync(req.body.url);
      const duration = getMP3Duration(buffer);

      const artist = await Artist.findById(req.body.artistid);
      if (!artist) {
        return res
          .status(NOT_FOUND.code)
          .json({ ...NOT_FOUND, message: "Artist not found" });
      }

      const song = new Song({
        name: req.body.name,
        description: req.body.description,
        url: req.body.url,
        wallpaper: req.body.wallpaper,
        duration,
        artistid: req.body.artistid,
        albums: req.body.albums,
        lyrics: req.body.lyrics,
        categories: req.body.categories,
      });
      await song.save();

      artist.songs.push(song._id);
      await artist.save();

      if (song.albums.length) {
        const albums = await Album.find({
          _id: {
            $in: req.body.albums,
          },
        });
        for (const album of albums) {
          album.songs.push(song._id);
          await album.save();
        }
      }

      if (song.categories.length) {
        const categories = await Category.find({
          _id: {
            $in: req.body.categories,
          },
        });
        for (const category of categories) {
          category.songs.push(song._id);
          await category.save();
        }
      }

      const response = { ...CREATED, data: song };
      res.status(CREATED).json(response);
      logger.info(`Response: ${JSON.stringify(response, null, 2)}`);
    } catch (err) {
      logger.error(err.message);
      res.status(SERVER_ERROR.code).json(SERVER_ERROR);
    }
  })
  .get(async (req, res) => {
    try {
      logger.info("Getting songs");
      logger.info(`Request query: ${JSON.stringify(req.query, null, 2)}`);
      const filter = {};

      const search = req.query.search;
      const page = req.query.page;
      const perpage = req.query.perpage;
      const sort = req.query.sort;

      let sortOptions = {};
      if (sort) {
        for (const kv of sort.split(",")) {
          const kvarr = kv.split("__");
          if (kvarr.length > 1) {
            sortOptions[kvarr[0]] = kvarr[1] == "asc" ? 1 : -1;
          }
        }
      }

      if (search) {
        filter.$text = { $search: search };
      }

      queryToMongoFilter(req.query, filter);

      let data = [];
      let total = 0;
      let pagination = {};

      if (req.query.group__columns) {
        const group = { _id: {} };
        for (const gpcol of req.query.group__columns.split(",")) {
          group._id[gpcol] = `$${gpcol}`;
        }
        if (req.query.group__sums) {
          for (const gpsums of req.query.group__sums.split(",")) {
            group[gpsums] = { $sum: `$${gpsums}` };
          }
        }
        let project = {};
        if (req.query.projection) {
          for (const column of req.query.projection.split(" ")) {
            project[column] = { [column]: `$${column}` };
          }
        }

        const aggregate = [];

        aggregate.push({
          $match: filter,
        });
        aggregate.push({
          $group: group,
        });
        if (req.query.sort) {
          aggregate.push({
            $sort: sortOptions,
          });
        }

        data = await Song.aggregate(aggregate);
        total = data.length;
      } else {
        total = await Song.find(filter).countDocuments();

        if (page && perpage) {
          pagination = { page, perpage };
          const offset = (page - 1) * perpage;
          if (sort) {
            data = await Song.find(filter, req.query.projection || "")
              .sort(sortOptions)
              .skip(offset)
              .limit(perpage);
          } else {
            data = await Song.find(filter, req.query.projection || "")
              .skip(offset)
              .limit(perpage);
          }

          pagination.pagecounts = Math.ceil(total / perpage);
        } else {
          if (sort) {
            data = await Song.find(filter, req.query.projection || "").sort(
              sortOptions
            );
          } else {
            data = await Song.find(filter, req.query.projection || "");
          }
        }
      }

      const response = { ...OK, data, total, ...pagination };
      res.json(response);
      logger.info(`Response: ${JSON.stringify(response, null, 2)}`);
    } catch (err) {
      logger.error(err.message);
      res.status(SERVER_ERROR.code).json(SERVER_ERROR);
    }
  });

router
  .route("/:id")
  .get(async (req, res) => {
    try {
      logger.info("Getting song");
      logger.info(`Request params: ${JSON.stringify(req.params, null, 2)}`);
      const data = await Song.findById(
        req.params.id,
        req.query.projection || ""
      ).populate("artistid", "albums", "categories");
      if (!data) {
        return res
          .status(NOT_FOUND.code)
          .json({ ...NOT_FOUND, message: "Song not found" });
      }
      const response = { ...OK, data };
      res.json(response);
      logger.info(`Response: ${JSON.stringify(response, null, 2)}`);
    } catch (err) {
      logger.error(err.message);
      res.status(SERVER_ERROR.code).json(SERVER_ERROR);
    }
  })
  .put(async (req, res) => {
    try {
      logger.info("Updating song");
      logger.info(`Request params: ${JSON.stringify(req.params, null, 2)}`);
      logger.info(`Request body: ${JSON.stringify(req.body, null, 2)}`);
      const data = await Song.findById(req.params.id);
      if (!data) {
        return res
          .status(NOT_FOUND.code)
          .json({ ...NOT_FOUND, message: "Song not found" });
      }

      const artists = await Artist.find({
        songs: data._id,
      });
      for (const artist of artists) {
        artist.songs.pull(data._id);
        await artist.save();
      }

      const albums = await Album.find({
        songs: data._id,
      });
      for (const album of albums) {
        album.songs.pull(data._id);
        await album.save();
      }

      const categories = await Category.find({
        songs: data._id,
      });
      for (const category of categories) {
        category.songs.pull(data._id);
        await category.save();
      }

      for (const [k, v] of Object.entries({ ...req.body })) {
        if (!["_id"].includes(k)) {
          data[k] = v;
        }
      }
      await data.save();

      if (req.body.artistid) {
        const artist = await Artist.findById(req.body.artistid);
        if (!artist) {
          return res
            .status(NOT_FOUND.code)
            .json({ ...NOT_FOUND, message: "Artist not found" });
        }
        artist.songs.push(data._id);
        await artist.save();
      }

      if (data.albums.length) {
        const albums = await Album.find({
          _id: { $in: data.albums },
        });
        for (const album of albums) {
          album.songs.push(data._id);
          await album.save();
        }
      }

      if (data.categories.length) {
        const categories = await Category.find({
          _id: { $in: data.categories },
        });
        for (const category of categories) {
          category.songs.push(data._id);
          await category.save();
        }
      }

      const response = { ...OK, data };
      res.json(response);
      logger.info(`Response: ${JSON.stringify(response, null, 2)}`);
    } catch (err) {
      logger.error(err.message);
      res.status(SERVER_ERROR.code).json(SERVER_ERROR);
    }
  })
  .delete(async (req, res) => {
    try {
      logger.info("Deleting song");
      logger.info(`Request params: ${JSON.stringify(req.params, null, 2)}`);
      const data = await Song.findById(req.params.id);
      if (!data) {
        return res
          .status(NOT_FOUND.code)
          .json({ ...NOT_FOUND, message: "Song not found" });
      }

      await data.remove();

      res.sendStatus(204);
    } catch (err) {
      logger.error(err.message);
      res.status(SERVER_ERROR.code).json(SERVER_ERROR);
    }
  });

module.exports = router;
