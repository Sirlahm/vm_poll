import expressAsyncHandler from "express-async-handler";
import User from "../models/user.js";
import { Poll, Pollster, Vote } from "../models/pollModel.js"
import { validationResult } from "express-validator";
import fs from 'fs';
import { processPollstersCsv } from "../util/processCsv.js";
import { uploadToCloudinary } from "../util/uploadCloudinary.js";
import { Parser } from 'json2csv';


const createPoll = expressAsyncHandler(async (req, res) => {
    const {
        title,
        description,
        pollType,
        questions,
        endDate,
        allowAnonymous = true,
        requireAuth = false,
    } = req.body;

    if (new Date(endDate) <= new Date()) {
        throw new Error("End date must be in the future");
    }

    // Get poll image from req.files
    let pollImage = null;
    const pollImageFile = req?.files?.find(f => f.fieldname === 'pollImage');
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
        requireAuth
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
            throw new Error('Poll not found');
        }
        // // Check if poll is private and user doesn't have access
        // if (!poll.isPublic && (!req.user || poll.creator._id.toString() !== req.user._id.toString())) {
        //     return res.status(403).json({ error: 'Access denied' });
        // }
        res.json({ poll });
    } catch (error) {
        throw new Error(error);

    }
})

const getMyPolls = expressAsyncHandler(async (req, res) => {
    try {

        const query = { creator: req.user._id };
        const polls = await Poll.find(query)
        res.json(polls);
    } catch (error) {
        throw new Error(error);

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
            throw new Error('Poll not found');
        }

        // Check creator authorization
        if (String(poll.creator) !== String(req.user._id)) {
            throw new Error('Unauthorized');
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
        throw new Error(error);
    }
});

const updatePoll = expressAsyncHandler(async (req, res) => {
    try {
        const { id } = req.params;

        const existingPoll = await Poll.findById(id);
        if (!existingPoll) {
            throw new Error('Poll not found');
        }
        const updateData = {
            ...req.body,
        };

        // Convert endDate to a Date object if it's present
        if (req.body.endDate) {
            const newEndDate = new Date(req.body.endDate);
            if (newEndDate <= new Date()) {
                throw new Error("End date must be in the future");
            }
            updateData.endDate = newEndDate;
        }

        // Handle poll image upload
        const pollImageFile = req?.files?.find(f => f.fieldname === 'pollImage');
        if (pollImageFile) {
            const pollImage = await uploadToCloudinary(pollImageFile.path, 'poll-images');
            updateData.image = pollImage;
        }

        // Handle question updates (with image uploads)
        if (req.body.questions) {
            const parsedQuestions = JSON.parse(req.body.questions);
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
                                image: optionImage,
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
                        image: questionImage,
                    };
                })
            );

            updateData.questions = processedQuestions;
        }

        const updatedPoll = await Poll.findByIdAndUpdate(id, updateData, {
            new: true,
        }).populate('creator', 'name avatar');

        res.status(200).json({
            message: 'Poll updated successfully',
            poll: updatedPoll.getResults(),
        });

    } catch (error) {
        throw new Error(error);

    }
});



const getResult = expressAsyncHandler(async (req, res) => {
    try {
        const poll = await Poll.findById(req.params.id);

        if (!poll) {
            throw new Error('Poll not found');
        }
        const results = poll.getResults();
        res.json({ results });
    } catch (error) {
        throw new Error(error);
    }
})


const publishPoll = expressAsyncHandler(async (req, res) => {
    try {
        const { id } = req.params;
        const poll = await Poll.findById(id)
        if (!poll) {
            throw new Error('Poll not found');

        }
        if (poll.isPublish) {
            throw new Error('Poll has already been published!');

        }
        poll.isPublish = true
        if (!poll.isOn) {
            poll.status = "scheduled"
        }
        poll.save()
        res.json({ poll: poll, message: "Poll Published Successfully" });
    } catch (error) {
        throw new Error(error);

    }
})


const togglePollStatus = expressAsyncHandler(async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body
        const poll = await Poll.findById(id)
        if (!poll) {
            throw new Error('Poll not found');
        }
        if (!poll.isPublish) {
            throw new Error('Publish Poll before you start poll');

        }
        if (status) {
            poll.status = "live"
            poll.isOn = true
        } else {
            poll.status = "closed"
            poll.isOn = false

        }
        poll.save()
        res.json({ poll: poll });
    } catch (error) {
        throw new Error(error);
    }
})

const importPollsters = expressAsyncHandler(async (req, res) => {
    try {
        const { id } = req.params;
        await processPollstersCsv(id, req.file, req.user._id);
        res.json({ message: 'Pollsters imported successfully' });
    } catch (error) {
        throw new Error(error);
    }
})


const resetPoll = expressAsyncHandler(async (req, res) => {
    try {
        const { id } = req.params;
        const poll = await Poll.findById(id);
        if (!poll) {
            throw new Error('Poll not found');
        }
        await Pollster.deleteMany({ poll: id });
        await Vote.deleteMany({ poll: id });

        res.json({ message: 'Poll reset successfully' });
    } catch (error) {
        throw new Error(error);
    }
});



const duplicatePoll = expressAsyncHandler(async (req, res) => {
    const { id } = req.params;

    // Fetch the original poll
    const originalPoll = await Poll.findById(id).lean();
    if (!originalPoll) {
        res.status(404);
        throw new Error('Original poll not found');
    }

    // Duplicate the questions and options
    const duplicatedQuestions = originalPoll.questions.map((question) => {
        const duplicatedOptions = question.options.map((option) => ({
            text: option.text,
            image: option.image, // shallow copy of image data
            votes: 0
        }));

        return {
            title: question.title,
            description: question.description,
            type: question.type,
            required: question.required,
            options: duplicatedOptions,
            order: question.order
        };
    });

    // Construct the new poll
    const duplicatedPoll = new Poll({
        title: `${originalPoll.title} (Copy)`,
        description: originalPoll.description,
        image: originalPoll.image,
        creator: req.user._id,
        pollType: originalPoll.pollType,
        questions: duplicatedQuestions,
        allowAnonymous: originalPoll.allowAnonymous,
        requireAuth: originalPoll.requireAuth,
        isPublic: originalPoll.isPublic,
        isActive: true,
        status: 'building',
        isOn: false,
        isPublish: false,
        totalVotes: 0,
        uniqueVoters: 0,
        totalPollsters: 0,
        createdAt: new Date(),
        updatedAt: new Date()
    });

    await duplicatedPoll.save();
    await duplicatedPoll.populate('creator', 'name avatar');

    res.status(201).json({
        message: 'Poll duplicated successfully',
        poll: duplicatedPoll
    });
});


const exportPollAsCSV = expressAsyncHandler(async (req, res) => {
    const { id } = req.params;

    const poll = await Poll.findById(id).lean();
    if (!poll) {
        res.status(404);
        throw new Error('Poll not found');
    }

    // Flatten poll data for CSV
    const csvRows = [];

    poll.questions.forEach((question, qIndex) => {
        question.options.forEach((option, oIndex) => {
            csvRows.push({
                'Poll Title': poll.title,
                'Question #': qIndex + 1,
                'Question Title': question.title,
                'Question Type': question.type,
                'Option #': oIndex + 1,
                'Option Text': option.text,
                'Votes': option.votes ?? 0
            });
        });
    });

    // Convert to CSV
    const parser = new Parser();
    const csv = parser.parse(csvRows);

    // Set headers
    res.header('Content-Type', 'text/csv');
    res.attachment(`${poll.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_export.csv`);
    return res.send(csv);
});

export default {
    createPoll,
    getPolls,
    getPoll,
    getMyPolls,
    deletePoll,
    updatePoll,
    getResult,
    getPollsters,
    publishPoll,
    togglePollStatus,
    importPollsters,
    resetPoll,
    duplicatePoll,
    exportPollAsCSV
};