import mongoose,{Schema} from "mongoose";

const CommentsSchema=new Schema({
    content:{
        type: String,
        required: true
    },
    video:{
        type: mongoose.Types.ObjectId,
        ref: "videos",
        required: true
    },
    owner:{
        type: mongoose.Types.ObjectId,
        ref: "users",
        required: true
    }
},{
    timestamps: true
})

export const Comment=mongoose.model("Comment", CommentsSchema)