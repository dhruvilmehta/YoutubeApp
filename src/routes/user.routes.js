import { Router } from "express";
import {
  addComment,
  addVideoToPlaylist,
  changeCurrentPassword,
  createNewPlaylist,
  createTweet,
  deleteComment,
  getCurrentUser,
  getNLatestTweets,
  getPlaylists,
  getTweetsOfUser,
  getUserChannelProfile,
  getWatchHistory,
  loginUser,
  logoutUser,
  refreshAccessToken,
  registerUser,
  updateAccountDetails,
  updateUserAvatar,
  updateUserCoverImage,
} from "../controllers/user.controller.js";
import { upload } from "../middlewares/multer.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

router.route("/register").post(
  upload.fields([
    {
      name: "avatar",
      maxCount: 1,
    },
    {
      name: "coverImage",
      maxCount: 1,
    },
  ]),
  registerUser
);

router.route("/login").post(loginUser);

// Secured Routes
router.route("/logout").post(verifyJWT, logoutUser);
router.route("/refresh-token").post(refreshAccessToken);
router.route("/change-password").post(verifyJWT, changeCurrentPassword);
router.route("/current-user").get(verifyJWT, getCurrentUser);
router.route("/update-account").patch(verifyJWT, updateAccountDetails);
router
  .route("/avatar")
  .patch(verifyJWT, upload.single("avatar"), updateUserAvatar);
router
  .route("/cover-image")
  .patch(verifyJWT, upload.single("coverImage"), updateUserCoverImage);
router.route("/c/:username").get(verifyJWT, getUserChannelProfile);
router.route("/history").get(verifyJWT, getWatchHistory);

router.route("/create-playlist").post(verifyJWT, createNewPlaylist)
router.route("/get-playlists").get(verifyJWT, getPlaylists)
router.route("/add-video-to-playlist").patch(verifyJWT, addVideoToPlaylist)

router.route("/create-comment").post(verifyJWT, addComment)
router.route("/delete-comment").delete(verifyJWT, deleteComment)

router.route("/create-tweet").post(verifyJWT, createTweet)
router.route("/get-user-tweets").get(verifyJWT, getTweetsOfUser)
router.route("/get-feed-tweets/:page").get(getNLatestTweets)

export default router;
