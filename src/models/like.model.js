// _id string pk
//   comment ObjectId comments
//   createdAt Date
//   updatedAt Date
//   video ObjectId videos
//   likedBy ObjectId users
//   tweet ObjectId tweets

import mongoose, { Schema } from "mongoose";

const likeSchema = new Schema(
  {
    comment: [
      {
        type: Schema.Types.ObjectId,
        ref: "Comment",
      },
    ],
    // either of 'video', 'comment', 'tweet' will be assigned others are null
    video: [
      {
        type: Schema.Types.ObjectId,
        ref: "Video",
      },
    ],
    likedBy: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    tweet: [
      {
        type: Schema.Types.ObjectId,
        ref: "Tweet",
      },
    ],
  },
  { timestamps: true }
);

export const Like = mongoose.model("Like", likeSchema);
