const { Schema, model } = require("mongoose");
const { REQUIRED_STRING } = require("../constants/mongoose-constant");

const albumSchema = new Schema(
  {
    name: REQUIRED_STRING,
    wallpaper: REQUIRED_STRING,
    songs: [
      {
        type: Schema.Types.ObjectId,
        ref: "Song",
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

albumSchema.index({ "$**": "text" });

module.exports = model("Album", albumSchema);
