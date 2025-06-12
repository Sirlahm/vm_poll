import expressAsyncHandler from "express-async-handler";
import User from "../models/user.js";
import { Poll, Pollster, Vote } from "../models/pollModel.js"
import { validationResult } from "express-validator";
import csv from 'csv-parser';
import fs from 'fs';
import { processPollstersCsv } from "../util/processCsv.js";
import { uploadToCloudinary } from "../util/uploadCloudinary.js";

// const createPoll = expressAsyncHandler(async (req, res) => {
//     try {
//         const errors = validationResult(req);
//         if (!errors.isEmpty()) {
//             return res.status(400).json({ errors: errors.array() });
//         }
//         const {
//             title,
//             description,
//             optionType,
//             options,
//             endDate,
//             allowAnonymous = true,
//             requireAuth = false,
//             isPublic = true,
//         } = req.body;

//         if (new Date(endDate) <= new Date()) {
//             throw new Error("End date must be in the future");
//         }
//         const poll = new Poll({
//             title,
//             description,
//             creator: req.user._id,
//             optionType,
//             options: options.map(opt => ({ text: opt.text })),
//             endDate: new Date(endDate),
//             allowAnonymous,
//             requireAuth,
//             isPublic,
//         });

//         await poll.save();
//         await poll.populate('creator', 'name avatar');
//         await User.findByIdAndUpdate(req.user._id, {
//             $inc: { pollsCreated: 1 }
//         });

//         res.status(201).json({
//             message: 'Poll created successfully',
//             poll
//         });
//     } catch (error) {
//         throw new Error(error);
//     }
// });

const createPoll = expressAsyncHandler(async (req, res) => {
    console.log(req.files);

    try {
        const {
            title,
            description,
            pollType,
            questions,
            endDate,
            allowAnonymous = true,
            requireAuth = false,
            isPublic = true,
            tags = []
        } = req.body;

        if (new Date(endDate) <= new Date()) {
            throw new Error("End date must be in the future");
        }

        // Get poll image from req.files
        let pollImage = null;
        const pollImageFile = req?.files?.find(f => f.fieldname === 'pollImage');
        console.log({ image: pollImageFile })
        if (pollImageFile) {
            pollImage = await uploadToCloudinary(pollImageFile.path, 'poll-images');
        }

        // Process questions and handle image uploads
        const parsedQuestions = JSON.parse(questions);
        const processedQuestions = await Promise.all(
            parsedQuestions.map(async (question, qIndex) => {
                // Question image
                let questionImage = null;
                const questionImageFile = req?.files?.find(f => f.fieldname === `questionImage_${qIndex}`);
                if (questionImageFile) {
                    questionImage = await uploadToCloudinary(questionImageFile.path, 'question-images');
                }

                // Process options
                const processedOptions = await Promise.all(
                    question.options.map(async (option, oIndex) => {
                        let optionImage = null;
                        const optionImageFile = req?.files?.find(f => f.fieldname === `optionImage_${qIndex}_${oIndex}`);
                        if (optionImageFile) {
                            optionImage = await uploadToCloudinary(optionImageFile.path, 'option-images');
                        }

                        return {
                            text: option.text,
                            image: optionImage
                        };
                    })
                );

                return {
                    title: question.title,
                    description: question.description,
                    type: question.type,
                    required: question.required,
                    options: processedOptions,
                    order: qIndex,
                    image: questionImage
                };
            })
        );

        // Create the poll
        const poll = new Poll({
            title,
            description,
            image: pollImage,
            creator: req.user._id,
            pollType,
            questions: processedQuestions,
            endDate: new Date(endDate),
            allowAnonymous,
            requireAuth,
            isPublic,
            tags
        });

        await poll.save();
        await poll.populate('creator', 'name avatar');

        // Handle CSV upload for closed polls
        const csvFile = req?.files?.find(f => f.fieldname === 'pollstersCsv');
        if (pollType === 'closed' && csvFile) {
            await processPollstersCsv(poll._id, csvFile, req.user._id);
        }

        // Update poll creation count
        await User.findByIdAndUpdate(req.user._id, {
            $inc: { pollsCreated: 1 }
        });

        res.status(201).json({
            message: 'Poll created successfully',
            poll: poll.getResults()
        });
    } catch (error) {
        console.error('Create poll error:', error);
        res.status(500).json({
            message: 'Error creating poll',
            error: error.message
        });
    }
});


const getPolls = expressAsyncHandler(async (req, res) => {
    try {
        const polls = await Poll.find()
            .populate('creator', 'name avatar')
        res.json(polls);
    } catch (error) {
        throw new Error(error);
    }
})


const getPoll = expressAsyncHandler(async (req, res) => {
    try {
        const { id } = req.params;
        const poll = await Poll.findById(id)
            .populate('creator', 'name avatar');

        if (!poll) {
            return res.status(404).json({ error: 'Poll not found' });
        }

        // // Check if poll is private and user doesn't have access
        // if (!poll.isPublic && (!req.user || poll.creator._id.toString() !== req.user._id.toString())) {
        //     return res.status(403).json({ error: 'Access denied' });
        // }
        res.json({ poll });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
})

const getMyPolls = expressAsyncHandler(async (req, res) => {
    try {

        const query = { creator: req.user._id };
        const polls = await Poll.find(query)
        res.json(polls);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
})


const getPollsters = expressAsyncHandler(async (req, res) => {
    try {
        const { pollId } = req.params
        const pollsters = await Pollster.find({ poll: pollId })
        res.json(pollsters);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
})

const deletePoll = expressAsyncHandler(async (req, res) => {
    try {
        const { id } = req.params;
        const poll = await Poll.findById(id);

        if (!poll) {
            return res.status(404).json({ message: 'Poll not found' });
        }

        // Check creator authorization
        if (String(poll.creator) !== String(req.user._id)) {
            return res.status(403).json({ message: 'Unauthorized' });
        }

        // Delete related pollsters and votes
        await Pollster.deleteMany({ poll: id });
        await Vote.deleteMany({ poll: id });

        // Delete the poll itself
        await Poll.findByIdAndDelete(id);

        // Update user poll count
        await User.findByIdAndUpdate(req.user._id, {
            $inc: { pollsCreated: -1 }
        });

        res.json({ message: 'Poll deleted successfully' });
    } catch (error) {
        console.error('Delete poll error:', error);
        res.status(500).json({
            message: 'Error deleting poll',
            error: error.message
        });
    }
});

const updatePoll = expressAsyncHandler(async (req, res) => {
    try {
        const { id } = req.params;
        const existingPoll = await Poll.findById(id);

        if (!existingPoll) {
            return res.status(404).json({ message: 'Poll not found' });
        }

        // Ensure the logged-in user is the creator
        if (String(existingPoll.creator) !== String(req.user._id)) {
            return res.status(403).json({ message: 'Unauthorized' });
        }

        const {
            title,
            description,
            pollType,
            questions,
            endDate,
            allowAnonymous,
            requireAuth,
            isPublic,
            tags
        } = req.body;

        if (endDate && new Date(endDate) <= new Date()) {
            throw new Error("End date must be in the future");
        }

        // Upload new poll image if provided
        const pollImageFile = req?.files?.find(f => f.fieldname === 'pollImage');
        if (pollImageFile) {
            const newImage = await uploadToCloudinary(pollImageFile.path, 'poll-images');
            existingPoll.image = newImage;
        }

        // Parse and process updated questions
        if (questions) {
            const parsedQuestions = JSON.parse(questions);
            const processedQuestions = await Promise.all(
                parsedQuestions.map(async (question, qIndex) => {
                    let questionImage = null;
                    const questionImageFile = req?.files?.find(f => f.fieldname === `questionImage_${qIndex}`);
                    if (questionImageFile) {
                        questionImage = await uploadToCloudinary(questionImageFile.path, 'question-images');
                    }

                    const processedOptions = await Promise.all(
                        question.options.map(async (option, oIndex) => {
                            let optionImage = null;
                            const optionImageFile = req?.files?.find(f => f.fieldname === `optionImage_${qIndex}_${oIndex}`);
                            if (optionImageFile) {
                                optionImage = await uploadToCloudinary(optionImageFile.path, 'option-images');
                            }

                            return {
                                text: option.text,
                                image: optionImage
                            };
                        })
                    );

                    return {
                        title: question.title,
                        description: question.description,
                        type: question.type,
                        required: question.required,
                        options: processedOptions,
                        order: qIndex,
                        image: questionImage
                    };
                })
            );

            existingPoll.questions = processedQuestions;
        }

        // Update other fields if provided
        if (title) existingPoll.title = title;
        if (description) existingPoll.description = description;
        if (pollType) existingPoll.pollType = pollType;
        if (endDate) existingPoll.endDate = new Date(endDate);
        if (allowAnonymous !== undefined) existingPoll.allowAnonymous = allowAnonymous;
        if (requireAuth !== undefined) existingPoll.requireAuth = requireAuth;
        if (isPublic !== undefined) existingPoll.isPublic = isPublic;
        if (tags) existingPoll.tags = tags;

        await existingPoll.save();
        await existingPoll.populate('creator', 'name avatar');

        res.json({
            message: 'Poll updated successfully',
            poll: existingPoll.getResults()
        });
    } catch (error) {
        console.error('Edit poll error:', error);
        res.status(500).json({
            message: 'Error editing poll',
            error: error.message
        });
    }
});


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
    getPoll,
    getMyPolls,
    deletePoll,
    updatePoll,
    getResult,
    getPollsters
};