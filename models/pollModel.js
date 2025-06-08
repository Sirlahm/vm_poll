import mongoose from "mongoose";

const optionSchema = new mongoose.Schema({
    text: {
        type: String,
        required: [true, 'Option text is required'],
        trim: true,
        maxlength: [200, 'Option text cannot exceed 200 characters']
    },
    votes: {
        type: Number,
        default: 0
    },
});

const pollSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Poll title is required'],
        trim: true,
        maxlength: [200, 'Title cannot exceed 200 characters']
    },
    description: {
        type: String,
        trim: true,
        maxlength: [1000, 'Description cannot exceed 1000 characters']
    },
    creator: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    optionType: {
        type: String,
        enum: ['single', 'multiple'],
        default: 'single',
        required: true
    },
    options: {
        type: [optionSchema],
        validate: [
            {
                validator: function (v) {
                    return v && v.length >= 2;
                },
                message: 'A poll must have at least 2 options'
            },
            {
                validator: function (v) {
                    return v && v.length <= 10;
                },
                message: 'A poll cannot have more than 10 options'
            }
        ]
    },
    endDate: {
        type: Date,
        required: [true, 'End date is required'],
        validate: {
            validator: function (v) {
                return v > new Date();
            },
            message: 'End date must be in the future'
        }
    },
    isActive: {
        type: Boolean,
        default: true
    },
    totalVotes: {
        type: Number,
        default: 0
    },
    uniqueVoters: {
        type: Number,
        default: 0
    },
    allowAnonymous: {
        type: Boolean,
        default: true
    },
    requireAuth: {
        type: Boolean,
        default: false
    },
    isPublic: {
        type: Boolean,
        default: true
    },
    tags: [{
        type: String,
        trim: true,
        maxlength: 30
    }],
    shareCode: {
        type: String,
        unique: true,
    },
    viewCount: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

// Indexes for better performance
pollSchema.index({ creator: 1, createdAt: -1 });
// pollSchema.index({ shareCode: 1 });
pollSchema.index({ endDate: 1 });
pollSchema.index({ isActive: 1, isPublic: 1 });
pollSchema.index({ tags: 1 });

// Generate share code before saving
pollSchema.pre('save', function (next) {
    if (!this.shareCode) {
        this.shareCode = generateShareCode();
    }
    next();
});

// Check if poll is expired
pollSchema.methods.isExpired = function () {
    return new Date() > this.endDate;
};

// Calculate vote percentages
pollSchema.methods.getResults = function () {
    const results = this.options.map(option => ({
        _id: option._id,
        text: option.text,
        votes: option.votes,
        percentage: this.totalVotes > 0 ? Math.round((option.votes / this.totalVotes) * 100) : 0
    }));

    return {
        pollId: this._id,
        title: this.title,
        totalVotes: this.totalVotes,
        uniqueVoters: this.uniqueVoters,
        options: results,
        isExpired: this.isExpired(),
        endDate: this.endDate
    };
};

function generateShareCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

export default mongoose.model('Poll', pollSchema);