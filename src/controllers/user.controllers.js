import { asyncHandler } from "../utils/asyncHandler.js";
import { apiError } from "../utils/apiError.js";
import { User } from "../models/user.model.js";
import {
  uploadOnCloudinary,
  deleteFromCloudinary,
} from "../utils/cloudinary.js";
import { apiResponse } from "../utils/apiResponse.js";
import jwt from "jsonwebtoken";
import { Types } from "mongoose";

const genrerateAccessAndRefreshToken = async (userId) => {
  try {
    //generate access token and refresh token
    const user = await User.findById(userId);
    if (!user) {
      throw new apiError(404, "User not found");
    }

    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    //save refresh token in db
    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    throw new apiError(500, "Something went wrong while generating tokens");
  }
};

const registerUser = asyncHandler(async (req, res) => {
  const { fullname, email, username, password } = req.body;
  if (JSON.stringify(req.body) === "{}") {
    throw new apiError(400, "body object is empty");
  }

  //validation
  if (
    [fullname, email, username, password].some((field) => {
      field?.trim() === "";
    })
  ) {
    throw new apiError(400, "All fields are required");
  }

  const existedUser = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (existedUser) {
    throw new apiError(409, "User with email or username already exists");
  }

  console.warn(req.files);

  const avatarLocalPath = req.files?.avatar?.[0]?.path;
  const coverImageLocalPath = req.files?.coverImage?.[0]?.path;

  if (!avatarLocalPath) {
    throw new apiError(400, "Avatar is missing");
  }

  //send images to cloudinary

  // const avatar = await uploadOnCloudinary(avatarLocalPath)

  // let coverImage =''
  // if(coverImageLocalPath){
  // coverImage = await uploadOnCloudinary(coverImageLocalPath)
  // }

  //refactoring upload

  let avatar;
  try {
    avatar = await uploadOnCloudinary(avatarLocalPath);
    console.log("uploaded avatar", avatar);
  } catch (error) {
    console.log("Error uploading avatar", error);
    throw new apiError(500, "Failed to upload avatar");
  }

  let coverImage;
  try {
    coverImage = await uploadOnCloudinary(coverImageLocalPath);
    console.log("uploaded coverImage", coverImage);
  } catch (error) {
    console.log("Error uploading coverImage", error);
    throw new apiError(500, "Failed to upload coverImage");
  }

  try {
    const user = await User.create({
      fullname,
      avatar: avatar.url,
      coverImage: coverImage.url,
      email,
      password,
      username: username.toLowerCase(),
    });

    const createdUser = await User.findById(user._id).select(
      "-password -refreshToken"
    );

    if (!createdUser) {
      throw new apiError(
        500,
        "something went wrong while registering the user"
      );
    }

    return res
      .status(201)
      .json(new apiResponse(200, createdUser, "User registered successfully"));
  } catch (error) {
    console.log("User creation failed");

    if (avatar) {
      await deleteFromCloudinary(avatar.publicId);
    }
    if (coverImage) {
      await deleteFromCloudinary(coverImage.publicId);
    }
    throw new apiError(
      500,
      "something went wrong while registering the user and images were deleted"
    );
  }
});

const logInUser = asyncHandler(async (req, res) => {
  //get data from body
  const { email, username, password } = req.body;
  if (JSON.stringify(req.body) === "{}") {
    throw new apiError(400, "body object is empty");
  }

  //validation
  if ([email, username, password].some((field) => field?.trim() === "")) {
    throw new apiError(400, "All fields are required");
  }
  const existedUser = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (!existedUser) {
    throw new apiError(404, "User not found");
  }

  const isPasswordValid = await existedUser.isPasswordCorrect(password);

  if (!isPasswordValid) {
    throw new apiError(401, "Invalid credentials");
  }
  const { accessToken, refreshToken } = await genrerateAccessAndRefreshToken(
    existedUser._id
  );

  const loggedInUser = await User.findById(existedUser._id).select(
    "-password -refreshToken"
  );
  if (!loggedInUser) {
    throw new apiError(500, "Something went wrong while logging in");
  }
  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  };
  return res
    .status(200)
    .cookie("refreshToken", refreshToken, options)
    .cookiie("accessToken", accessToken, options)
    .json(
      new apiResponse(
        200,
        {
          user: loggedInUser,
          accessToken: accessToken,
          refreshToken: refreshToken,
        },
        "User logged in successfully"
      )
    );
});

const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken =
    req.cookies.refreshToken || req.body.refreshToken;
  if (!incomingRefreshToken)
    throw new apiError(401, "refresh token is missing");

  try {
    //verify incoming refresh token
    const decoded = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );
    const user = await User.findById(decoded?._id);
    if (!user)
      throw new apiError(401, "Invalid refresh token - user not found");
    if (incomingRefreshToken !== user?.refreshToken)
      throw new apiError(401, "refresh token does not match");

    const options = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
    };

    const { accessToken, refreshToken: newRefreshToken } =
      await generateAccessToken(user._id);

    return res
      .status(200)
      .cookie("refreshToken", newRefreshToken, options)
      .cookie("accessToken", accessToken, options)
      .json(
        new apiResponse(
          200,
          {
            accessToken,
            refreshToken: newRefreshToken,
          },
          "Access token refreshed successfully"
        )
      );
  } catch (error) {
    throw new apiError(
      401,
      "something went wrong with the refresh token while generating new token"
    );
  }
});

const logOutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: { refresh: undefined },
    },
    { new: true }
  );

  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  };

  return res
    .status(200)
    .clearCookie("refreshToken", options)
    .clearCookie("accessToken", options)
    .json(new apiResponse(200, null, "Logged out successfully"));
});

const changeCurrentPassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  if (JSON.stringify(req.body) === "{}") {
    throw new apiError(400, "body object is empty");
  }
  if ([oldPassword, newPassword].some((field) => field?.trim() === "")) {
    throw new apiError(400, "All fields are required");
  }

  if (oldPassword === newPassword) {
    throw new apiError(400, "Old password and new password cannot be the same");
  }

  const user = await User.findById(req.user?._id).select("+password");
  if (!user) {
    throw new apiError(404, "User not found");
  }

  const isPasswordValid = await user.isPasswordCorrect(oldPassword);
  if (!isPasswordValid) {
    throw new apiError(401, "Old password is incorrect");
  }

  user.password = newPassword;
  await user.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(new apiResponse(200, null, "Password changed successfully"));
});

const getCurrentUserDetails = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(new apiResponse(200, req.user, "User details fetched successfully"));
});

const updateAccountDetails = asyncHandler(async (req, res) => {
  const { fullname, username, email } = req.body;
  if (JSON.stringify(req.body) === "{}") {
    throw new apiError(400, "body object is empty");
  }
  if (!fullname || !username || !email) {
    throw new apiError(400, "All fields are required");
  }

  if ([fullname, username, email].some((field) => field?.trim() === "")) {
    throw new apiError(400, "All fields are required");
  }
  const existedUser = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: { fullname, username: username.toLowerCase(), email },
    },
    { new: true, runValidators: true }
  ).select("-password -refreshToken");
  return res
    .status(200)
    .json(
      new apiResponse(200, existedUser, "Account details updated successfully")
    );
});

const updateUserAvatar = asyncHandler(async (req, res) => {
  const avatarLocalPath = req.file?.path;
  if (!avatarLocalPath) {
    throw new apiError(400, "Avatar is missing");
  }
  await deleteFromCloudinary(req.user?.avatar?.publicId);
  const avatar = await uploadOnCloudinary(avatarLocalPath);
  if (!avatar) {
    throw new apiError(500, "Failed to upload avatar");
  }
  if (!avatar.url) {
    throw new apiError(500, "Failed to get avatar url");
  }
  const updatedUser = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: { avatar: avatar.url },
    },
    { new: true }
  ).select("-password -refreshToken");
  return res
    .status(200)
    .json(new apiResponse(200, updatedUser, "Avatar updated successfully"));
});

const updateUserCoverImage = asyncHandler(async (req, res) => {
  const coverImageLocalPath = req.file?.path;
  if (!coverImageLocalPath) {
    throw new apiError(400, "Cover Image is missing");
  }
  await deleteFromCloudinary(req.user?.coverImage?.publicId);
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);
  if (!coverImage) {
    throw new apiError(500, "Failed to upload cover Image");
  }
  if (!coverImage.url) {
    throw new apiError(500, "Failed to get cover Image url");
  }
  const updatedUser = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: { coverImage: coverImage.url },
    },
    { new: true }
  ).select("-password -refreshToken");
  return res
    .status(200)
    .json(
      new apiResponse(200, updatedUser, "Cover Image updated successfully")
    );
});

const getUserChannelProfile = asyncHandler(async (req, res) => {
  const { username } = req.params;

  if (!username?.trim()) {
    throw new apiError(400, "username is required");
  }
  const channel = await User.aggregate([
    {
      $match: { username: username?.toLowerCase() },
    },
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "channel",
        as: "subscribers",
      },
    },
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "subscriber",
        as: "subscribedTo",
      },
    },
    {
      $addFields: {
        subscribersCount: { $size: "$subscribers" },
        channelsSubscribedToCount: { $size: "$subscribedTo" },
        isSubscribed: {
          $cond: {
            if: { $in: [req.user?._id, "$subscribers.subscriber"] },
            then: true,
            else: false,
          },
        },
      },
    },
    {
      //project only neccessary fields
      $project: {
        fullname: 1,
        username: 1,
        email: 1,
        avatar: 1,
        subscribersCount: 1,
        channelsSubscribedToCount: 1,
        isSubscribed: 1,
        coverImage: 1,
      },
    },
  ]);

  if (!channel || channel.length === 0) {
    throw new apiError(404, "Channel not found");
  }

  return res
    .status(200)
    .json(
      new apiResponse(200, channel[0], "Channel profile fetched successfully")
    );
});
const getWatchHistory = asyncHandler(async (req, res) => {
  const user = await User.aggregate([
    {
      $match: { _id: Types.ObjectId.createFromHexString(req.user?._id) },
    },
    {
      $lookup: {
        from: "videos",
        localField: "watchHistory",
        foreignField: "_id",
        as: "watchHistory",
        pipeline: [
          {
            $lookup: {
              from: "users",
              localField: "owner",
              foreignField: "_id",
              as: "ownerDetails",
              pipeline: [{ $project: { fullname: 1, username: 1, avatar: 1 } }],
            },
          },
          {
            $addFields: {
              owner: { $first: "$ownerDetails" },
            },
          },
        ],
      },
    },
  ]);

  return res
    .status(200)
    .json(
      new apiResponse(
        200,
        user?.[0]?.watchHistory || [],
        "Watch history fetched successfully"
      )
    );
});

export {
  registerUser,
  logInUser,
  refreshAccessToken,
  logOutUser,
  changeCurrentPassword,
  getCurrentUserDetails,
  updateAccountDetails,
  updateUserAvatar,
  updateUserCoverImage,
  getUserChannelProfile,
  getWatchHistory,
};
