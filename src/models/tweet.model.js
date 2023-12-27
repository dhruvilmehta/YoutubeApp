import mongoose,{Schema} from "mongoose";

const tweetSchema=new Schema({
    owner:{
        type: mongoose.Types.ObjectId,
        required: true,
        ref: "User"
    },
    content:{
        type: String, 
        required: true
    }
},{
    timestamps: true
})

export const Tweet=mongoose.model("Tweet", tweetSchema)