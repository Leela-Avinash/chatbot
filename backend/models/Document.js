import mongoose from "mongoose";

const documentSchema = new mongoose.Schema({
    chatId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Chat",
        required: true,
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    title: {
        type: String,
        required: true,
    },
    type: {
        type: String,
        enum: ["text", "code", "sheet", "image"],
        default: "text",
    },
    kind: {
        type: String,
        enum: ["text", "code", "sheet", "image"],
        default: "text",
    },
    content: {
        type: mongoose.Schema.Types.Mixed,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
    updatedAt: {
        type: Date,
        default: Date.now,
    },
});

documentSchema.pre("save", function (next) {
    this.updatedAt = new Date();
    next();
});

const Document = mongoose.model("Document", documentSchema);
export default Document;
