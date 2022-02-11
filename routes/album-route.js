const express = require("express");
const {
  SERVER_ERROR,
  CREATED,
  OK,
  NOT_FOUND,
} = require("../constants/response-constants");
const logger = require("../utils/logger");
const { queryToMongoFilter } = require("../utils/mongoose-utils");
const Song = require("../models/Song");
const Album = require("../models/Album");
const Category = require("../models/Category");

const router = express.Router();

router
  .route("/")
  .post(async (req, res) => {
    try {
      logger.info("Creating album");
      logger.info(`Request body: ${JSON.stringify(req.body, null, 2)}`);
      const album = new Album({
        name: req.body.name,
        wallpaper: req.body.wallpaper,
        songs: req.body.songs,
        categories: req.body.categories,
      });
      await album.save();

      if (album.songs.length) {
        const songs = await Song.find({
          _id: {
            $in: album.songs,
          },
        });
        for (const song of songs) {
          song.albums.push(album._id);
          await song.save();
        }
      }

      if (album.categories.length) {
        const categories = await Category.find({
          _id: {
            $in: album.categories,
          },
        });
        for (const category of categories) {
          category.albums.push(album._id);
          await category.save();
        }
      }

      const response = { ...CREATED, data: album };
      res.status(CREATED).json(response);
      logger.info(`Response: ${JSON.stringify(response, null, 2)}`);
    } catch (err) {
      logger.error(err.message);
      res.status(SERVER_ERROR.code).json(SERVER_ERROR);
    }
  })
  .get(async (req, res) => {
    try {
      logger.info("Getting albums");
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

        data = await Album.aggregate(aggregate);
        total = data.length;
      } else {
        total = await Album.find(filter).countDocuments();

        if (page && perpage) {
          pagination = { page, perpage };
          const offset = (page - 1) * perpage;
          if (sort) {
            data = await Album.find(filter, req.query.projection || "")
              .sort(sortOptions)
              .skip(offset)
              .limit(perpage);
          } else {
            data = await Album.find(filter, req.query.projection || "")
              .skip(offset)
              .limit(perpage);
          }

          pagination.pagecounts = Math.ceil(total / perpage);
        } else {
          if (sort) {
            data = await Album.find(filter, req.query.projection || "").sort(
              sortOptions
            );
          } else {
            data = await Album.find(filter, req.query.projection || "");
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
      logger.info("Getting album");
      logger.info(`Request params: ${JSON.stringify(req.params, null, 2)}`);
      const data = await Album.findById(
        req.params.id,
        req.query.projection || ""
      ).populate(["songs", "categories"]);
      if (!data) {
        return res
          .status(NOT_FOUND.code)
          .json({ ...NOT_FOUND, message: "Album not found" });
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
      logger.info("Updating album");
      logger.info(`Request params: ${JSON.stringify(req.params, null, 2)}`);
      logger.info(`Request body: ${JSON.stringify(req.body, null, 2)}`);
      const data = await Album.findById(req.params.id);
      if (!data) {
        return res
          .status(NOT_FOUND.code)
          .json({ ...NOT_FOUND, message: "Album not found" });
      }

      const songs = await Song.find({
        albums: data._id,
      });
      for (const song of songs) {
        song.albums.pull(data._id);
        await song.save();
      }

      const categories = await Category.find({
        albums: data._id,
      });
      for (const category of categories) {
        category.albums.pull(data._id);
        await category.save();
      }

      for (const [k, v] of Object.entries({ ...req.body })) {
        if (!["_id"].includes(k)) {
          data[k] = v;
        }
      }
      await data.save();

      if (data.songs.length) {
        const songs = await Song.find({
          _id: {
            $in: data.songs,
          },
        });
        for (const song of songs) {
          song.albums.push(data._id);
          await song.save();
        }
      }

      if (data.categories.length) {
        const categories = await Category.find({
          _id: {
            $in: data.categories,
          },
        });
        for (const category of categories) {
          category.albums.push(data._id);
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
      logger.info("Deleting album");
      logger.info(`Request params: ${JSON.stringify(req.params, null, 2)}`);
      const data = await Album.findById(req.params.id);
      if (!data) {
        return res
          .status(NOT_FOUND.code)
          .json({ ...NOT_FOUND, message: "Album not found" });
      }

      await data.remove();

      res.sendStatus(204);
    } catch (err) {
      logger.error(err.message);
      res.status(SERVER_ERROR.code).json(SERVER_ERROR);
    }
  });
module.exports = router;
