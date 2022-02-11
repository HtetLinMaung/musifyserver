const { Schema, model } = require("mongoose");
const { REQUIRED_STRING } = require("../constants/mongoose-constant");

const artistSchema = new Schema(
  {
    profile: REQUIRED_STRING,
    name: REQUIRED_STRING,
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

artistSchema.index({ "$**": "text" });

module.exports = model("Artist", artistSchema);
