import expressAsyncHandler from "express-async-handler";
import User from "../models/user.js";
import Poll from "../models/pollModel.js"
import { validationResult } from "express-validator";

const createPoll = expressAsyncHandler(async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        const {
            title,
            description,
            optionType,
            options,
            endDate,
            allowAnonymous = true,
            requireAuth = false,
            isPublic = true,
        } = req.body;

        if (new Date(endDate) <= new Date()) {
            throw new Error("End date must be in the future");
        }
        const poll = new Poll({
            title,
            description,
            creator: req.user._id,
            optionType,
            options: options.map(opt => ({ text: opt.text })),
            endDate: new Date(endDate),
            allowAnonymous,
            requireAuth,
            isPublic,
        });

        await poll.save();
        await poll.populate('creator', 'name avatar');
        await User.findByIdAndUpdate(req.user._id, {
            $inc: { pollsCreated: 1 }
        });

        res.status(201).json({
            message: 'Poll created successfully',
            poll
        });
    } catch (error) {
        throw new Error(error);
    }
});

const getPolls = expressAsyncHandler(async (req, res) => {
    try {
        const {
            page = 1,
            limit = 10,
            search,
            optionType,
            sortBy = 'createdAt',
            sortOrder = 'desc'
        } = req.query;

        const query = { isPublic: true, isActive: true };

        // Search filter
        if (search) {
            query.$or = [
                { title: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } }
            ];
        }

        // Option type filter
        if (optionType) {
            query.optionType = optionType;
        }

        const sortOptions = {};
        sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

        const polls = await Poll.find(query)
            .populate('creator', 'username firstName lastName avatar')
            .sort(sortOptions)
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .exec();

        const total = await Poll.countDocuments(query);

        res.json({
            polls,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            total
        });
    } catch (error) {
        throw new Error(error);
    }
})


const getPollByShareCode = expressAsyncHandler(async (req, res) => {
    try {
        const { shareCode } = req.params;
        const poll = await Poll.findOne({ shareCode })
            .populate('creator', 'name avatar');

        if (!poll) {
            return res.status(404).json({ error: 'Poll not found' });
        }

        // Check if poll is private and user doesn't have access
        if (!poll.isPublic && (!req.user || poll.creator._id.toString() !== req.user._id.toString())) {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Increment view count
        await Poll.findByIdAndUpdate(poll._id, { $inc: { viewCount: 1 } });

        res.json({ poll });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
})

const getMyPolls = expressAsyncHandler(async (req, res) => {
    try {
        const { page = 1, limit = 10, status = 'all' } = req.query;

        const query = { creator: req.user._id };

        if (status === 'active') {
            query.isActive = true;
            query.endDate = { $gt: new Date() };
        } else if (status === 'expired') {
            query.endDate = { $lte: new Date() };
        } else if (status === 'inactive') {
            query.isActive = false;
        }

        const polls = await Poll.find(query)
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .exec();

        const total = await Poll.countDocuments(query);

        res.json({
            polls,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            total
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
})

const deletePoll = expressAsyncHandler(async (req, res) => {
    try {
        const poll = await Poll.findById(req.params.id);
        if (!poll) {
            return res.status(404).json({ error: 'Poll not found' });
        }

        // Check ownership
        if (poll.creator.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: 'Access denied' });
        }

        await Poll.findByIdAndDelete(req.params.id);

        // Update user's poll count
        await User.findByIdAndUpdate(req.user._id, {
            $inc: { pollsCreated: -1 }
        });

        res.json({ message: 'Poll deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
})

const updatePoll = expressAsyncHandler(async (req, res) => {
    try {
        const poll = await Poll.findById(req.params.id);
        if (!poll) {
            return res.status(404).json({ error: 'Poll not found' });
        }

        // Check ownership
        if (poll.creator.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: 'Access denied' });
        }

        await Poll.findByIdAndUpdate(req.params.id, { ...req.body }, { new: true, runValidators: true });

        res.json({ message: 'Poll updated successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
})

const getResult = expressAsyncHandler(async (req, res) => {
    try {
        const poll = await Poll.findById(req.params.id);

        if (!poll) {
            return res.status(404).json({ error: 'Poll not found' });
        }
        const results = poll.getResults();
        res.json({ results });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
})

export default {
    createPoll,
    getPolls,
    getPollByShareCode,
    getMyPolls,
    deletePoll,
    updatePoll,
    getResult
};