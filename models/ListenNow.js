const { Schema, model } = require("mongoose");

const listenNowSchema = new Schema(
  {
    category: {
      type: Schema.Types.ObjectId,
      ref: "Category",
    },
  },
  {
    timestamps: true,
  }
);

listenNowSchema.index({ "$**": "text" });

module.exports = model("ListenNow", listenNowSchema);
