import expressAsyncHandler from "express-async-handler";
import User from "../models/user.js";
import { Poll, Pollster, Vote } from "../models/pollModel.js"
// import Vote from "../models/voteModel.js";
import { getIO } from "../config/socketConnection.js";
import { validationResult } from "express-validator";


const submitVote = expressAsyncHandler(async (req, res) => {

    const { pollId } = req.params;
    const { responses, voteToken, voterName } = req.body;

    const poll = await Poll.findById(pollId);
    if (!poll) {
        throw new Error('Poll not found');

    }

    if (poll.isExpired()) {
        throw new Error('Poll has expired');
    }

    if (poll.status !== 'live') {
        res.status(401);
        throw new Error('Poll is not live');
    }

    if (poll.requireVoterName && !voterName) {
        throw new Error('Participant name is required for this poll');
    } 

    let voter = null;
    let pollster = null;
    let voterIP = null;

    if (poll.pollType === 'closed') {
        // Closed poll - validate vote token
        if (!voteToken) {
            throw new Error('Vote token is required for closed polls');
        }

        pollster = await Pollster.findOne({ voteToken, poll: pollId });
        if (!pollster) {
            throw new Error('Invalid vote token');

        }

        if (pollster.hasVoted) {
            throw new Error('You have already voted in this poll');
        }
    } else {
        // Open poll - handle voter identification
        voterIP = req.ip || req.connection.remoteAddress;

        if (req.user) {
            voter = req.user._id;
            // Check if user already voted
            const existingVote = await Vote.findOne({ poll: pollId, voter });
            if (existingVote) {
                throw new Error('You have already voted in this poll');

            }
        } else if (!poll.allowAnonymous) {
            throw new Error('Authentication required for this poll');
        } else {
            // Check if IP already voted (for anonymous users)
            const existingVote = await Vote.findOne({ poll: pollId, voterIP });
            if (existingVote) {
                throw new Error('You have already voted in this poll');
            }
        }
    }

    // Validate responses
    const validatedResponses = [];
    for (const response of responses) {
        const question = poll.questions.id(response.questionId);
        if (!question) {
            throw new Error('Invalid question ID');
        }

        if (question.required && (!response.selectedOptions || response.selectedOptions.length === 0)) {
            throw new Error(`Question "${question.title}" is required`);
        }

        if (question.type === 'single' && response.selectedOptions.length > 1) {
            throw new Error(`Question "${question.title}" allows only one selection`);
        }

        // Validate option IDs
        const validatedOptions = [];
        // for (const selectedOption of response.selectedOptions) {
        //     const option = question.options.id(selectedOption.optionId);
        //     if (!option) {
        //         throw new Error('Invalid option ID');

        //     }
        //     validatedOptions.push({
        //         optionId: selectedOption.optionId,
        //         optionText: option.text
        //     });
        // }
        for (const selectedOption of response.selectedOptions) {
            if (selectedOption.optionId) {
                const option = question.options.id(selectedOption.optionId);
                if (!option) {
                    throw new Error('Invalid option ID');
                }
                validatedOptions.push({
                    optionId: selectedOption.optionId,
                    optionText: option.text,
                    isCustom: false
                });
            } else if (poll.showOtherOption && selectedOption.optionText?.trim()) {
                validatedOptions.push({
                    optionId: null,
                    optionText: selectedOption.optionText.trim(),
                    isCustom: true
                });
            } else {
                throw new Error('Invalid custom option input or not allowed');
            }
        }

        validatedResponses.push({
            questionId: response.questionId,
            selectedOptions: validatedOptions
        });
    }

    // Create vote record
    const vote = new Vote({
        poll: pollId,
        voter,
        pollster: pollster?._id,
        voterIP,
        responses: validatedResponses,
        userAgent: req.get('User-Agent'),
        voterName: poll.requireVoterName ? voterName : undefined,

    });

    await vote.save();

    // Update vote counts
    // for (const response of validatedResponses) {
    //     const question = poll.questions.id(response.questionId);
    //     for (const selectedOption of response.selectedOptions) {
    //         const option = question.options.id(selectedOption.optionId);
    //         option.votes += 1;
    //     }
    // }
    for (const response of validatedResponses) {
        const question = poll.questions.id(response.questionId);
        for (const selectedOption of response.selectedOptions) {
            if (!selectedOption.isCustom) {
                const option = question.options.id(selectedOption.optionId);
                option.votes += 1;
            }
        }
    }

    poll.totalVotes += 1;
    poll.uniqueVoters += 1;
    await poll.save();

    // Mark pollster as voted (for closed polls)
    if (pollster) {
        pollster.hasVoted = true;
        pollster.votedAt = new Date();
        await pollster.save();
    }
    const updatedPoll = await Poll.findById(pollId);
    const results = updatedPoll.getResults();

    // Emit real-time update via Socket.IO
    getIO().to(`poll_${pollId}`).emit('voteUpdate', {
        pollId,
        results,
        // newVote: {
        //     totalVotes: updatedPoll.totalVotes,
        //     uniqueVoters: updatedPoll.uniqueVoters
        // }
    });
    res.status(200).json({
        message: 'Vote submitted successfully',
        voteId: vote._id
    });


});



export default {
    submitVote
};