const express = require("express");
const {
  SERVER_ERROR,
  CREATED,
  OK,
  NOT_FOUND,
} = require("../constants/response-constants");
const logger = require("../utils/logger");
const Artist = require("../models/Artist");
const { queryToMongoFilter } = require("../utils/mongoose-utils");
const Song = require("../models/Song");
const Album = require("../models/Album");
const Category = require("../models/Category");
const { deleteFile, publicPath } = require("../utils/file-helper");
const path = require("path");

const router = express.Router();

router
  .route("/")
  .post(async (req, res) => {
    try {
      logger.info("Creating category");
      logger.info(`Request body: ${JSON.stringify(req.body, null, 2)}`);

      const category = new Category({
        name: req.body.name,
        wallpaper: req.body.wallpaper,
        albums: req.body.albums,
        songs: req.body.songs,
      });
      await category.save();

      if (category.albums.length) {
        const albums = await Album.find({
          _id: {
            $in: category.albums,
          },
        });
        for (const album of albums) {
          album.categories.push(category._id);
          await album.save();
        }
      }

      if (category.songs.length) {
        const songs = await Song.find({
          _id: {
            $in: category.songs,
          },
        });
        for (const song of songs) {
          song.categories.push(category._id);
          await song.save();
        }
      }

      const response = { ...CREATED, data: category };
      res.status(CREATED.code).json(response);
      logger.info(`Response: ${JSON.stringify(response, null, 2)}`);
    } catch (err) {
      logger.error(err.message);
      res.status(SERVER_ERROR.code).json(SERVER_ERROR);
    }
  })
  .get(async (req, res) => {
    try {
      logger.info("Getting categories");
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

        data = await Category.aggregate(aggregate);
        total = data.length;
      } else {
        total = await Category.find(filter).countDocuments();

        if (page && perpage) {
          pagination = { page, perpage };
          const offset = (page - 1) * perpage;
          if (sort) {
            data = await Category.find(filter, req.query.projection || "")
              .sort(sortOptions)
              .skip(offset)
              .limit(perpage);
          } else {
            data = await Category.find(filter, req.query.projection || "")
              .skip(offset)
              .limit(perpage);
          }

          pagination.pagecounts = Math.ceil(total / perpage);
        } else {
          if (sort) {
            data = await Category.find(filter, req.query.projection || "").sort(
              sortOptions
            );
          } else {
            data = await Category.find(filter, req.query.projection || "");
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
      logger.info("Getting category");
      logger.info(`Request params: ${JSON.stringify(req.params, null, 2)}`);
      const data = await Category.findById(
        req.params.id,
        req.query.projection || ""
      ).populate(["songs", "albums"]);
      if (!data) {
        return res
          .status(NOT_FOUND.code)
          .json({ ...NOT_FOUND, message: "Category not found" });
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
      logger.info("Updating category");
      logger.info(`Request params: ${JSON.stringify(req.params, null, 2)}`);
      logger.info(`Request body: ${JSON.stringify(req.body, null, 2)}`);
      const data = await Category.findById(req.params.id);
      if (!data) {
        return res
          .status(NOT_FOUND.code)
          .json({ ...NOT_FOUND, message: "Category not found" });
      }

      const albums = await Album.find({
        categories: data._id,
      });
      for (const album of albums) {
        album.categories.pull(data._id);
        await album.save();
      }

      const songs = await Song.find({
        categories: data._id,
      });
      for (const song of songs) {
        song.categories.pull(data._id);
        await song.save();
      }

      if (data.wallpaper !== req.body.wallpaper) {
        deleteFile(path.join(publicPath, data.wallpaper.split("/").pop()));
      }

      for (const [k, v] of Object.entries({ ...req.body })) {
        if (!["_id"].includes(k)) {
          data[k] = v;
        }
      }
      await data.save();

      if (data.albums.length) {
        const albums = await Album.find({
          _id: {
            $in: data.albums,
          },
        });
        for (const album of albums) {
          album.categories.push(data._id);
          await album.save();
        }
      }

      if (data.songs.length) {
        const songs = await Song.find({
          _id: {
            $in: data.songs,
          },
        });
        for (const song of songs) {
          song.categories.push(data._id);
          await song.save();
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
      logger.info("Deleting category");
      logger.info(`Request params: ${JSON.stringify(req.params, null, 2)}`);
      const data = await Artist.findById(req.params.id);
      if (!data) {
        return res
          .status(NOT_FOUND.code)
          .json({ ...NOT_FOUND, message: "Category not found" });
      }
      const albums = await Album.find({
        categories: data._id,
      });
      for (const album of albums) {
        album.categories.pull(data._id);
        await album.save();
      }

      const songs = await Song.find({
        categories: data._id,
      });
      for (const song of songs) {
        song.categories.pull(data._id);
        await song.save();
      }

      deleteFile(path.join(publicPath, data.wallpaper.split("/").pop()));

      await data.remove();

      res.sendStatus(204);
    } catch (err) {
      logger.error(err.message);
      res.status(SERVER_ERROR.code).json(SERVER_ERROR);
    }
  });

module.exports = router;
