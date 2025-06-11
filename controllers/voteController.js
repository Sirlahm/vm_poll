import expressAsyncHandler from "express-async-handler";
import User from "../models/user.js";
import { Poll, Pollster, Vote } from "../models/pollModel.js"
// import Vote from "../models/voteModel.js";
import { getIO } from "../config/socketConnection.js";
import { validationResult } from "express-validator";


const submitVote = expressAsyncHandler(async (req, res) => {
    try {
        const { pollId } = req.params;
        const { responses, voteToken } = req.body;

        const poll = await Poll.findById(pollId);
        if (!poll) {
            return res.status(404).json({ message: 'Poll not found' });
        }

        if (poll.isExpired()) {
            return res.status(400).json({ message: 'Poll has expired' });
        }

        if (!poll.isActive) {
            return res.status(400).json({ message: 'Poll is not active' });
        }

        let voter = null;
        let pollster = null;
        let voterIP = null;

        if (poll.pollType === 'closed') {
            // Closed poll - validate vote token
            if (!voteToken) {
                return res.status(400).json({ message: 'Vote token is required for closed polls' });
            }

            pollster = await Pollster.findOne({ voteToken, poll: pollId });
            if (!pollster) {
                return res.status(400).json({ message: 'Invalid vote token' });
            }

            if (pollster.hasVoted) {
                return res.status(400).json({ message: 'You have already voted in this poll' });
            }
        } else {
            // Open poll - handle voter identification
            voterIP = req.ip || req.connection.remoteAddress;

            if (req.user) {
                voter = req.user._id;
                // Check if user already voted
                const existingVote = await Vote.findOne({ poll: pollId, voter });
                if (existingVote) {
                    return res.status(400).json({ message: 'You have already voted in this poll' });
                }
            } else if (!poll.allowAnonymous) {
                return res.status(401).json({ message: 'Authentication required for this poll' });
            } else {
                // Check if IP already voted (for anonymous users)
                const existingVote = await Vote.findOne({ poll: pollId, voterIP });
                if (existingVote) {
                    return res.status(400).json({ message: 'You have already voted in this poll' });
                }
            }
        }

        // Validate responses
        const validatedResponses = [];
        for (const response of responses) {
            const question = poll.questions.id(response.questionId);
            if (!question) {
                return res.status(400).json({ message: 'Invalid question ID' });
            }

            if (question.required && (!response.selectedOptions || response.selectedOptions.length === 0)) {
                return res.status(400).json({ message: `Question "${question.title}" is required` });
            }

            if (question.type === 'single' && response.selectedOptions.length > 1) {
                return res.status(400).json({ message: `Question "${question.title}" allows only one selection` });
            }

            // Validate option IDs
            const validatedOptions = [];
            for (const selectedOption of response.selectedOptions) {
                const option = question.options.id(selectedOption.optionId);
                if (!option) {
                    return res.status(400).json({ message: 'Invalid option ID' });
                }
                validatedOptions.push({
                    optionId: selectedOption.optionId,
                    optionText: option.text
                });
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
            userAgent: req.get('User-Agent')
        });

        await vote.save();

        // Update vote counts
        for (const response of validatedResponses) {
            const question = poll.questions.id(response.questionId);
            for (const selectedOption of response.selectedOptions) {
                const option = question.options.id(selectedOption.optionId);
                option.votes += 1;
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

    } catch (error) {
        console.error('Submit vote error:', error);
        res.status(500).json({
            message: 'Error submitting vote',
            error: error.message
        });
    }
});



export default {
    submitVote
};