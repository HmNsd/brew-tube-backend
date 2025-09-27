// _id string pk
//   watchHistory ObjectId[] videos
//   username string
//   email string
//   fullName string
//   coverimage string
//   avatar string
//   password string
//   refreshToken string
//   createdAt Date
//   updatedAt Date

import mongoose, { Schema } from "mongoose";
import bcrypt from "bcrypt"
import jwt from "jsonwebtoken"

const userSchema = new Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    fullname: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    avatar: {
      type: String, // cloudinary url
      required: true,
    },
    coverImage: {
      type: String, // cloudinary url
    },
    watchHistory: [
      {
        type: Schema.Types.ObjectId,
        ref: "Video",
      },
    ],

    password: {
      type: String,
      required: [true, "Password is required"],
    },
    refreshToken: {
      type: String,
    },
  },

//createdAt Date, updatedAt Date : wil use timestamps  
  { timestamps: true }
);

userSchema.pre("save", async function (next){

    if(!this.isModified('password')) return next()
    this.password = bcrypt.hash(this.password, 10)

    next()
  })

  userSchema.methods.isPasswordCorrect = async function (password) {
    return await bcrypt.compare(password, this.password)
  }

  userSchema.method.generateAccessToken = function(){
    //short lived access token for user
   return jwt.sign({
      _id: this._id,
      email: this.email,
      username: this.username
    }, process.env.ACCESS_TOKEN_SECRET, {expiresIn: process.env.ACCESS_TOKEN_EXPIRY})
  }


  userSchema.methods.isPasswordCorrect = async function (password) {
    return await bcrypt.compare(password, this.password)
  }

  userSchema.method.generateRefreshToken = function(){
    //short lived access token for user
   return jwt.sign({
      _id: this._id,

    }, process.env.REFRESH_TOKEN_SECRET, {expiresIn: process.env.REFRESH_TOKEN_EXPIRY})
  }

export const User = mongoose.model("User", userSchema);
