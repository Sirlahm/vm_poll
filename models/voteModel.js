import mongoose from "mongoose";


const voteSchema = new mongoose.Schema({
    poll: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Poll',
        required: true
    },
    voter: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null // null for anonymous votes
    },
    voterIP: {
        type: String,
        required: true
    },
    selectedOptions: [{
        optionId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true
        },
        optionText: String
    }],
    userAgent: String,
    timestamp: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Compound indexes for better performance and preventing duplicate votes
voteSchema.index({ poll: 1, voter: 1 }, { sparse: true });
voteSchema.index({ poll: 1, voterIP: 1 });
voteSchema.index({ poll: 1, timestamp: -1 });

export default mongoose.model('Vote', voteSchema);