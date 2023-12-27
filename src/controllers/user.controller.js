import { ApiError } from '../utils/ApiError.js'
import {asyncHandler} from '../utils/asyncHandler.js'
import { User } from '../models/user.model.js'
import { uploadOnCloudinary } from '../utils/cloudinary.js'
import { ApiResponse } from '../utils/ApiResponse.js'
import jwt from "jsonwebtoken"
import mongoose from 'mongoose'
import { Playlist } from '../models/playlist.model.js'
import { Comment } from '../models/comments.model.js'
import { Tweet } from '../models/tweet.model.js'

const generateAccessAndRefreshTokens=async(userId)=>{
    try{
        const user=await User.findById(userId)
        const accessToken=user.generateAccessToken()
        const refreshToken=user.generateRefreshToken()

        user.refreshToken=refreshToken
        await user.save({validateBeforeSave: false})

        return {accessToken, refreshToken}
    }catch(error){
        throw new ApiError(500, "Something went wrong while generating refresh and access token")
    }
}

const registerUser= asyncHandler(async (req,res)=>{
    const {fullName, email, username, password}=req.body
    if([fullName, email, username, password].some((field)=>
        field?.trim()==="")
    ){
        throw new ApiError(400, "some fields are missing is required")
    }

    const existedUser=await User.findOne({
        $or:[{username},{email}]
    })

    if(existedUser){
        throw new ApiError(409, "user with email or username already exists")
    }

    // console.log(req.files)
    const avatarLocalPath= req.files?.avatar[0]?.path
    // const coverImageLocalPath= req.files?.coverImage[0]?.path
    
    let coverImageLocalPath;
    if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length>0){
        coverImageLocalPath=req.files.coverImage[0].path
    }

    if(!avatarLocalPath){
        throw new ApiError(400, "Avatar file is required")
    }
    
    const avatar=await uploadOnCloudinary(avatarLocalPath)
    const coverImage=await uploadOnCloudinary(coverImageLocalPath)

    if(!avatar){
        throw new ApiError(400, "Avatar file is required")
    }

    const user= await User.create({
        fullName,
        avatar:avatar.url,
        coverImage:coverImage?.url || "",
        email,
        password,
        username:username.toLowerCase()
    })

    const createdUser= await User.findById(user._id).select(
        "-password -refreshToken"
    )

    if(!createdUser){
        throw new ApiError(500, "Something went wrong while registering the user")
    }

    res.status(201).json(new ApiResponse(201, createdUser, "User Registered Successfully"))
})

const loginUser=asyncHandler(async (req,res)=>{
    const {email, username, password}=req.body

    if(!username && !email){
        throw new ApiError(400, "username or email is required")
    }

    const user=await User.findOne({
        $or:[{username},{email}]
    })

    if(!user){
        throw new ApiError(404, "User does not exists")
    }
    
    const isPasswordValid=await user.isPasswordCorrect(password)

    if(!isPasswordValid){
        throw new ApiError(401, "Invalid user credentials")
    }

    const {accessToken, refreshToken}= await generateAccessAndRefreshTokens(user._id)

    const loggedInUser= await User.findById(user._id).select("-password -refreshToken")

    const options={
        httpOnly: true,
        secure: true
    }

    return res.status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(new ApiResponse(200, {
        user: loggedInUser, 
        accessToken, 
        refreshToken
    },
    "User logged In Successfully"
    ))

})

const logoutUser=asyncHandler(async(req, res)=>{
    await User.findByIdAndUpdate(req.user._id,{
        $set:{
            refreshToken: undefined
        }
    },{
        new: true
    })

    const options={
        httpOnly: true,
        secure: true
    }

    return res.status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User Logged Out"))
})

const refreshAccessToken=asyncHandler(async (req,res)=>{
    const incomingRefreshToken=req.cookies.refreshToken || req.body.refreshToken

    if(!incomingRefreshToken){
        throw new ApiError(401, "Unauthorized Request")
    }

    try {
        const decodedToken=jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET)
    
        const user=await User.findById(decodedToken?._id)
    
        if(!user){
            throw new ApiError(401, "Invalid Refresh Token")
        }
    
        if(incomingRefreshToken !== user?.refreshToken){
            throw new ApiError(401, "Refresh Token is expired or used")
        }
    
        const options={
            httpOnly: true,
            secure: true
        }
    
        const {accessToken, newRefreshToken}=await generateAccessAndRefreshTokens(user._id)
    
        return res.status(200)
        .cookie("accessToken",accessToken,options)
        .cookie("refreshToken",newRefreshToken,options)
        .json(new ApiResponse(200,{accessToken,refreshToken:newRefreshToken},"Refresh Token refreshed"))
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid refresh Token")
    }
})

const changeCurrentPassword=asyncHandler(async(req,res)=>{
    const {oldPassword, newPassword}=req.body
    const user=await User.findById(req.user?._id)
    const isPasswordCorrect= await user.isPasswordCorrect(oldPassword)

    if(!isPasswordCorrect){
        throw new ApiError(401, "Invalid Password")
    }

    user.password=newPassword
    await user.save({validateBeforeSave:false})

    return res.status(200).json(new ApiResponse(200,{}, "Password changed Successfully"))
})

const getCurrentUser = asyncHandler(async(req, res) => {
    return res.status(200).json(new ApiResponse(200, req.user, "User fetched successfully"))
})

const updateAccountDetails=asyncHandler(async(req,res)=>{
    const {fullName, email}=req.body

    if(!fullName || !email){
        throw new ApiError(400, "Fullname or Email required")
    }

    const user=await User.findByIdAndUpdate(req.user?._id,
    {
        $set:{
            fullName,
            email:email
        }
    },{new:true}).select("-password")

    return res.status(200).json(new ApiResponse(200, user, "Account details updated successfully"))
})

const updateUserAvatar=asyncHandler(async(req,res)=>{
    const avatarLocalPath=req.file?.path

    if(!avatarLocalPath){
        throw new ApiError(400, "Avatar file is missing")
    }

    const avatar= await uploadOnCloudinary(avatarLocalPath)

    if(!avatar.url){
        throw new ApiError(400, "Error while uploading on avatar")
    }

    const user=await User.findByIdAndUpdate(req.user?._id,
    {
        $set:{
            avatar:avatar.url
        }
    }
    ,{new:true}).select("-password")

    return res.status(200).json(new ApiResponse(200, user, "Avatar Image Updated Successfully"))
})

const updateUserCoverImage=asyncHandler(async(req,res)=>{
    const coverImageLocalPath=req.file?.path

    if(!coverImageLocalPath){
        throw new ApiError(400, "Cover image file is missing")
    }

    const coverImage= await uploadOnCloudinary(coverImageLocalPath)

    if(!coverImage.url){
        throw new ApiError(400, "Error while uploading on avatar")
    }

    const user=await User.findByIdAndUpdate(req.user?._id,
    {
        $set:{
            coverImage:coverImage.url
        }
    }
    ,{new:true}).select("-password")

    return res.status(200).json(new ApiResponse(200, user, "Cover Image Updated Successfully"))
})

const getUserChannelProfile=asyncHandler(async(req,res)=>{
    const {username}=req.params
    
    if(!username?.trim()){
        throw new ApiError(400, "username is missing")
    }

    const channel=await User.aggregate([
        {
            $match:{
                username: username?.toLowerCase()
            }
        },{
            $lookup:{
                from:"subscriptions",
                localField: "_id",
                foreignField: "channel",
                as: "subscribers"
            }
        },{
            $lookup:{
                from:"subscriptions",
                localField: "_id",
                foreignField: "subscriber",
                as: "subscribedTo"
            }
        },{
            $addFields:{
                subscribersCount:{
                    $size: "$subscribers"
                },
                channelsSubscribedToCount:{
                    $size: "$subscribedTo"
                },
                isSubscribed:{
                    $cond:{
                        if:{$in: [req.user?._id, "$subscribers.subscriber"]},
                        then: true,
                        else: false
                    }
                }
            }
        },{
            $project:{
                fullName: 1,
                username: 1,
                subscribersCount: 1,
                channelsSubscribedToCount: 1,
                isSubscribed: 1,
                avatar: 1,
                coverImage: 1,
                email: 1
            }
        }
    ])

    if(!channel?.length){
        throw new ApiError(404, "channel does not exists")
    }

    return res.status(200).json(new ApiResponse(200, channel[0], "User channel fetched successfully"))
})

const getWatchHistory=asyncHandler(async (req,res)=>{
    const user=await User.aggregate([
        {
            $match:{
                _id: new mongoose.Types.ObjectId(req.user._id)
            }
        },{
            $lookup:{
                from: "videos",
                localField: "watchHistory",
                foreignField: "_id",
                as: "watchHistory",
                pipeline:[
                    {
                        $lookup: {
                            from: "users",
                            localField: "owner",
                            foreignField: "_id",
                            as: "owner",
                            pipeline:[
                                {
                                    $project: {
                                        fullName: 1,
                                        username: 1,
                                        avatar: 1
                                    }
                                }
                            ]
                        }
                    },{
                        $addFields: {
                            owner: {
                                $first: "$owner"
                            }
                        }
                    }
                ]
            }
        }
    ])

    return res.status(200).json(new ApiResponse(200, user[0].watchHistory, "Watch History fetched successfully"))
})

const createNewPlaylist=asyncHandler(async(req,res)=>{
    const user=req.user
    const playlistName=req.body.playlistName
    const description=req.body.description || ""

    if(!playlistName?.trim()){
        throw new ApiError(400, "Playlist name is required")
    }

    const playlist=await Playlist.create({
        name: playlistName,
        description: description,
        owner: user,
        videos:[]
    })

    const savedPlaylist=await Playlist.findById(playlist._id)
    
    return res.status(201).json(new ApiResponse(201, savedPlaylist, "Playlist Created Successfully"))
})

const getPlaylists=asyncHandler(async(req,res)=>{
    const playlists=await Playlist.aggregate([
        {
            $match:{
                owner: req.user._id
            }
        },{
            $lookup: {
                from: "videos",
                localField: "videos",
                foreignField: "_id",
                as: "videos",
                pipeline:[
                    {
                        $project: {
                            _id: 1,
                        }
                    }
                ]
            }
        },{
            $project:{
                owner: 0,
                createdAt: 0,
                updatedAt: 0
            }
        }
    ])

    return res.status(200).json(new ApiResponse(200, playlists, "Playlists fetched successfully"))
})

const addVideoToPlaylist=asyncHandler(async(req,res)=>{
    const videoId=req.body.videoId
    const playlistId=req.body.playlistId

    const playlist=await Playlist.findById(playlistId)

    if(playlist.videos.includes(videoId)){
        throw new ApiError(409, "Video already added in the playlist")
    }

    playlist.videos.push(videoId)
    playlist.save()

    return res.status(201).json(new ApiResponse(201, playlist, "Video added to playlist"))
})

const addComment=asyncHandler(async(req,res)=>{
    const comment=req.body.comment
    const video=req.body.videoId    
    const user=req.user

    const savedComment=await Comment.create({
        content: comment,
        video: video,
        owner: user._id
    })

    const dbComment=await Comment.findById(savedComment._id)

    return res.status(201).json(new ApiResponse(201, dbComment, "Comment created successfully"))
})

const deleteComment=asyncHandler(async(req,res)=>{
    const commentId=req.body.commentId

    if(!commentId){
        throw new ApiError(401, "Comment id not found")
    }

    const comment=await Comment.findOneAndDelete({
        _id: commentId,
        owner: req.user._id
    })

    if(!comment){
        throw new ApiError(401, "Incorrent user or comment id")
    }
    
    return res.status(201).json(new ApiResponse(201, {}, "Comment deleted successfully"))
})

const createTweet=asyncHandler(async(req,res)=>{
    const userId=req.user._id
    const content=req.body.content

    if(!content?.trim()){
        throw new ApiError(401, "Tweet cannot be blank")
    }

    const savedTweet=await Tweet.create({
        owner: userId,
        content: content
    })

    const createdTweet=await Tweet.findById(savedTweet._id)

    if(!createdTweet){
        throw new ApiError(500, "Something went wrong, tweet did not save")
    }

    return res.status(201).json(new ApiResponse(201, createdTweet, "Tweet Created successfully"))
})

const getTweetsOfUser=asyncHandler(async(req,res)=>{
    const tweets=await Tweet.find({
        owner: req.user._id
    })

    return res.status(200).json(new ApiResponse(200, tweets, "User tweets fetched successfully"))
})

const getNLatestTweets=asyncHandler(async(req,res)=>{
    const {page}=req.params

    const tweets=await Tweet.aggregate([
        {
            $sort: {
                timestamp: 1
            }
        },{
            $skip: (page-1)*10
        },{
            $limit: 10
        },{
            $lookup:{
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "user",
                pipeline:[
                    {
                        $project: {
                            fullName: 1,
                            username: 1,
                            avatar: 1
                        }
                    }
                ]
            }
        },{
            $project: {
                owner: 0
            }
        }
    ])

    return res.status(200).json(new ApiResponse(200, tweets, "Tweets fetched successfully"))
})

export {registerUser, loginUser, logoutUser, refreshAccessToken, changeCurrentPassword, getCurrentUser, updateAccountDetails, updateUserAvatar, updateUserCoverImage, getUserChannelProfile, getWatchHistory, createNewPlaylist, getPlaylists, addVideoToPlaylist, addComment, deleteComment, createTweet, getTweetsOfUser, getNLatestTweets}