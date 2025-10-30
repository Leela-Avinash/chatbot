import mongoose from "mongoose";

// Define document reference schema separately
const documentReferenceSchema = new mongoose.Schema({
    documentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Document',
    },
    title: String,
    type: String,  // 'text', 'code', 'sheet'
    kind: String,  // same as type, for compatibility
    createdAt: Date,
}, { _id: false });  // Disable _id for subdocuments

const messageSchema = new mongoose.Schema({
    id: { 
        type: String, 
        required: true 
    },
    role: {
        type: String,
        required: true,
        enum: ["user", "assistant", "system"],
    },
    type: {
        type: String,
        enum: ["general", "weather", "document", "combined"],
        default: "general",
    },
    content: { 
        type: String, 
        required: false,  // Allow empty content for streaming messages
        default: ''
    },
    createdAt: { 
        type: Date, 
        default: Date.now 
    },
    // For weather messages - store data frontend needs to render
    weatherData: {
        cityName: String,
        country: String,
        current: mongoose.Schema.Types.Mixed,
        current_units: mongoose.Schema.Types.Mixed,
        timezone: String,
        daily: mongoose.Schema.Types.Mixed,
        hourly: mongoose.Schema.Types.Mixed,
    },
    // For document messages - store minimal data + reference
    documents: [documentReferenceSchema],
    metadata: {
        toolCalls: [mongoose.Schema.Types.Mixed],
        artifacts: [mongoose.Schema.Types.Mixed],
    },
});

const chatSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    title: {
        type: String,
        required: true,
        default: "New Chat",
    },
    messages: [messageSchema],
    visibility: {
        type: String,
        enum: ["private", "public"],
        default: "private",
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

chatSchema.pre("save", function (next) {
    this.updatedAt = new Date();
    next();
});

const Chat = mongoose.model("Chat", chatSchema);
export default Chat;
