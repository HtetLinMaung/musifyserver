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

const router = express.Router();

router
  .route("/")
  .post(async (req, res) => {
    try {
      logger.info("Creating artist");
      logger.info(`Request body: ${JSON.stringify(req.body, null, 2)}`);
      const artist = new Artist({
        name: req.body.name,
        profile: req.body.profile,
        songs: req.body.songs,
      });
      await artist.save();

      if (artist.songs.length) {
        const songs = await Song.find({
          _id: {
            $in: artist.songs,
          },
        });
        for (const song of songs) {
          song.artistid = artist._id;
          await song.save();
        }
      }
      const response = { ...CREATED, data: artist };
      res.status(CREATED.code).json(response);
      logger.info(`Response: ${JSON.stringify(response, null, 2)}`);
    } catch (err) {
      logger.error(err.message);
      res.status(SERVER_ERROR.code).json(SERVER_ERROR);
    }
  })
  .get(async (req, res) => {
    try {
      logger.info("Getting artists");
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

        data = await Artist.aggregate(aggregate);
        total = data.length;
      } else {
        total = await Artist.find(filter).countDocuments();

        if (page && perpage) {
          pagination = { page, perpage };
          const offset = (page - 1) * perpage;
          if (sort) {
            data = await Artist.find(filter, req.query.projection || "")
              .sort(sortOptions)
              .skip(offset)
              .limit(perpage);
          } else {
            data = await Artist.find(filter, req.query.projection || "")
              .skip(offset)
              .limit(perpage);
          }

          pagination.pagecounts = Math.ceil(total / perpage);
        } else {
          if (sort) {
            data = await Artist.find(filter, req.query.projection || "").sort(
              sortOptions
            );
          } else {
            data = await Artist.find(filter, req.query.projection || "");
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
      logger.info("Getting artist");
      logger.info(`Request params: ${JSON.stringify(req.params, null, 2)}`);
      const data = await Artist.findById(
        req.params.id,
        req.query.projection || ""
      ).populate("songs");
      if (!data) {
        return res
          .status(NOT_FOUND.code)
          .json({ ...NOT_FOUND, message: "Artist not found" });
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
      logger.info("Updating artist");
      logger.info(`Request params: ${JSON.stringify(req.params, null, 2)}`);
      logger.info(`Request body: ${JSON.stringify(req.body, null, 2)}`);
      const data = await Artist.findById(req.params.id);
      if (!data) {
        return res
          .status(NOT_FOUND.code)
          .json({ ...NOT_FOUND, message: "Artist not found" });
      }
      const songs = await Song.find({
        artistid: data._id,
      });
      for (const song of songs) {
        song.artistid = null;
        await song.save();
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
          song.artistid = data._id;
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
      logger.info("Deleting artist");
      logger.info(`Request params: ${JSON.stringify(req.params, null, 2)}`);
      const data = await Artist.findById(req.params.id);
      if (!data) {
        return res
          .status(NOT_FOUND.code)
          .json({ ...NOT_FOUND, message: "Artist not found" });
      }

      const songs = await Song.find({
        artistid: data._id,
      });
      for (const song of songs) {
        song.artistid = null;
        await song.save();
      }

      await data.remove();

      res.sendStatus(204);
    } catch (err) {
      logger.error(err.message);
      res.status(SERVER_ERROR.code).json(SERVER_ERROR);
    }
  });
module.exports = router;
