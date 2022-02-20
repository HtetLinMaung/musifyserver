const { Schema, model } = require("mongoose");
const {
  REQUIRED_STRING,
  DEFAULT_STRING,
} = require("../constants/mongoose-constant");

const songSchema = new Schema(
  {
    name: REQUIRED_STRING,
    description: DEFAULT_STRING,
    url: REQUIRED_STRING,
    wallpaper: REQUIRED_STRING,
    duration: {
      type: Number,
      default: 0,
    },
    artist: {
      type: Schema.Types.ObjectId,
      ref: "Artist",
    },
    albums: [
      {
        type: Schema.Types.ObjectId,
        ref: "Album",
      },
    ],
    lyrics: [
      {
        content: REQUIRED_STRING,
        start_time: {
          type: Number,
          default: 0,
        },
        end_time: {
          type: Number,
          default: 0,
        },
      },
    ],
    categories: [
      {
        type: Schema.Types.ObjectId,
        ref: "Category",
      },
    ],
  },
  {
    timestamps: true,
  }
);

songSchema.index({ "$**": "text" });

module.exports = model("Song", songSchema);
