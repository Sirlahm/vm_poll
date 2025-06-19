
import mongoose from "mongoose";

// Pollster Schema for closed polls
const pollsterSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        trim: true,
        lowercase: true
    },
    phone: {
        type: String,
        required: true,
        trim: true
    },
    name: {
        type: String,
        trim: true
    },
    poll: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Poll',
        required: true
    },
    hasVoted: {
        type: Boolean,
        default: false
    },
    voteToken: {
        type: String,
        unique: true,
        sparse: true
    },
    invitedAt: {
        type: Date,
        default: Date.now
    },
    votedAt: {
        type: Date
    }
}, {
    timestamps: true
});

pollsterSchema.index({ poll: 1, email: 1 }, { unique: true });
pollsterSchema.index({ poll: 1, phone: 1 });
pollsterSchema.index({ voteToken: 1 });

// Option Schema
const optionSchema = new mongoose.Schema({
    text: {
        type: String,
        required: [true, 'Option text is required'],
        trim: true,
        maxlength: [200, 'Option text cannot exceed 200 characters']
    },
    image: {
        url: String,
        publicId: String // For Cloudinary
    },
    votes: {
        type: Number,
        default: 0
    }
});

// Question Schema
const questionSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Question title is required'],
        trim: true,
        maxlength: [300, 'Question title cannot exceed 300 characters']
    },
    description: {
        type: String,
        trim: true,
        maxlength: [500, 'Question description cannot exceed 500 characters']
    },
    type: {
        type: String,
        enum: ['single', 'multiple'],
        default: 'single',
        required: true
    },
    required: {
        type: Boolean,
        default: true
    },
    options: {
        type: [optionSchema],
        validate: [
            {
                validator: function (v) {
                    return v && v.length >= 2;
                },
                message: 'A question must have at least 2 options'
            },
            {
                validator: function (v) {
                    return v && v.length <= 10;
                },
                message: 'A question cannot have more than 10 options'
            }
        ]
    },
    order: {
        type: Number,
        default: 0
    }
});

// Poll Schema
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
    image: {
        url: String,
        publicId: String // For Cloudinary
    },
    creator: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    pollType: {
        type: String,
        enum: ['open', 'closed'],
        default: 'open',
        required: true
    },
    questions: {
        type: [questionSchema],
        validate: [
            {
                validator: function (v) {
                    return v && v.length >= 1;
                },
                message: 'A poll must have at least 1 question'
            },
            {
                validator: function (v) {
                    return v && v.length <= 20;
                },
                message: 'A poll cannot have more than 20 questions'
            }
        ]
    },
    // endDate: {
    //     type: Date,
    //     required: [true, 'End date is required'],
    //     validate: {
    //         validator: function (v) {
    //             return v > new Date();
    //         },
    //         message: 'End date must be in the future'
    //     }
    // },
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
    // For open polls
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
    // For closed polls
    totalPollsters: {
        type: Number,
        default: 0
    },
    csvUploadHistory: [{
        filename: String,
        uploadedAt: {
            type: Date,
            default: Date.now
        },
        recordsCount: Number,
        uploadedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        }
    }],
    shareCode: {
        type: String,
        unique: true,
    },
    isOn: {
        type: Boolean,
        default: false
    },
    status: {
        type: String,
        enum: ['building', 'scheduled', 'live', 'closed'],
        default: 'building',
        required: true
    },
    isPublish: {
        type: Boolean,
        default: false
    },
    requireVoterName: {
        type: Boolean,
        default: false
    },
    showOtherOption: {
        type: Boolean,
        default: false
    },

}, {
    timestamps: true
});

// Updated Vote Schema
const voteSchema = new mongoose.Schema({
    poll: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Poll',
        required: true
    },
    voter: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    pollster: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Pollster',
        default: null
    },
    voterName: { 
        type: String,
        trim: true
    },
    voterIP: {
        type: String,
        required: function () {
            return !this.pollster; // Required only for open polls
        }
    },
    responses: [{
        questionId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true
        },
        selectedOptions: [{
            optionId: {
                type: mongoose.Schema.Types.ObjectId,
            },
            optionText: String,
            isCustom: {
                type: Boolean,
                default: false
            }
        }]
    }],
    userAgent: String,
    timestamp: {
        type: Date,
        default: Date.now
    },
    completedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Indexes
pollSchema.index({ creator: 1, createdAt: -1 });
pollSchema.index({ endDate: 1 });
pollSchema.index({ isActive: 1, isPublic: 1 });
pollSchema.index({ pollType: 1 });
pollSchema.index({ tags: 1 });

voteSchema.index({ poll: 1, voter: 1 }, { sparse: true });
voteSchema.index({ poll: 1, voterIP: 1 }, { sparse: true });
voteSchema.index({ poll: 1, pollster: 1 }, { sparse: true });
voteSchema.index({ poll: 1, timestamp: -1 });

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

// Calculate poll results
// pollSchema.methods.getResults = function () {
//     const questionResults = this.questions.map(question => {
//         const questionTotalVotes = question.options.reduce((sum, option) => sum + option.votes, 0);

//         const optionResults = question.options.map(option => ({
//             _id: option._id,
//             text: option.text,
//             image: option.image,
//             votes: option.votes,
//             percentage: questionTotalVotes > 0 ? Math.round((option.votes / questionTotalVotes) * 100) : 0
//         }));

//         return {
//             _id: question._id,
//             title: question.title,
//             description: question.description,
//             type: question.type,
//             totalVotes: questionTotalVotes,
//             options: optionResults
//         };
//     });

//     return {
//         pollId: this._id,
//         title: this.title,
//         description: this.description,
//         image: this.image,
//         pollType: this.pollType,
//         totalVotes: this.totalVotes,
//         uniqueVoters: this.uniqueVoters,
//         totalPollsters: this.totalPollsters,
//         questions: questionResults,
//         isExpired: this.isExpired(),
//         endDate: this.endDate
//     };
// };

pollSchema.methods.getResults = async function () {
    const questionResults = [];

    for (const question of this.questions) {
        const questionTotalVotes = question.options.reduce((sum, option) => sum + option.votes, 0);

        const optionResults = question.options.map(option => ({
            _id: option._id,
            text: option.text,
            image: option.image,
            votes: option.votes,
            percentage: questionTotalVotes > 0 ? Math.round((option.votes / questionTotalVotes) * 100) : 0,
            isCustom: false
        }));

        if (this.showOtherOption) {
            const customVotes = await Vote.aggregate([
                { $match: { poll: this._id } },
                { $unwind: '$responses' },
                { $match: { 'responses.questionId': question._id } },
                { $unwind: '$responses.selectedOptions' },
                { $match: { 'responses.selectedOptions.isCustom': true } },
                {
                    $group: {
                        _id: '$responses.selectedOptions.optionText',
                        votes: { $sum: 1 }
                    }
                }
            ]);

            customVotes.forEach(c => {
                optionResults.push({
                    _id: null,
                    text: c._id,
                    image: null,
                    votes: c.votes,
                    percentage: questionTotalVotes > 0 ? Math.round((c.votes / questionTotalVotes) * 100) : 0,
                    isCustom: true
                });
            });
        }

        questionResults.push({
            _id: question._id,
            title: question.title,
            description: question.description,
            type: question.type,
            totalVotes: questionTotalVotes,
            options: optionResults
        });
    }

    return {
        pollId: this._id,
        title: this.title,
        description: this.description,
        image: this.image,
        pollType: this.pollType,
        totalVotes: this.totalVotes,
        uniqueVoters: this.uniqueVoters,
        totalPollsters: this.totalPollsters,
        questions: questionResults,
        isExpired: this.isExpired(),
        endDate: this.endDate
    };
};


// Generate vote token for closed polls
pollsterSchema.pre('save',  async function  (next) {
     if (!this.voteToken && this.isNew) {
        try {
            const Poll = mongoose.model('Poll'); // Get the Poll model
            const poll = await Poll.findById(this.poll);

            if (poll && poll.pollType === 'closed') {
                this.voteToken = generateVoteToken();
            }
        } catch (err) {
            return next(err);
        }
    }
    next();
});

function generateShareCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

function generateVoteToken() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 32; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// Models
const Poll = mongoose.model('Poll', pollSchema);
const Vote = mongoose.model('Vote', voteSchema);
const Pollster = mongoose.model('Pollster', pollsterSchema);

export { Poll, Vote, Pollster };