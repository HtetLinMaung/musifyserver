const { Schema, model } = require("mongoose");
const { REQUIRED_STRING } = require("../constants/mongoose-constant");

const categorySchema = new Schema(
  {
    name: REQUIRED_STRING,
    wallpaper: REQUIRED_STRING,
    albums: [
      {
        type: Schema.Types.ObjectId,
        ref: "Album",
      },
    ],
    songs: [
      {
        type: Schema.Types.ObjectId,
        ref: "Song",
      },
    ],
  },
  {
    timestamps: true,
  }
);

categorySchema.index({ "$**": "text" });

module.exports = model("Category", categorySchema);
