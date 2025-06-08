import expressAsyncHandler from "express-async-handler";
import User from "../models/user.js";
import Poll from "../models/pollModel.js"
import Vote from "../models/voteModel.js";
import { getIO } from "../config/socketConnection.js";
import { validationResult } from "express-validator";


const submitVote = expressAsyncHandler(async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { pollId } = req.params;
        const { selectedOptions } = req.body;
        const voterIP = req.ip || req.connection.remoteAddress;
        const userAgent = req.get('User-Agent');

        const poll = await Poll.findById(pollId);

        if (!poll) {
            return res.status(404).json({ error: 'Poll not found' });
        }

        // Check if poll is expired
        if (poll.isExpired()) {
            return res.status(400).json({ error: 'Poll has expired' });
        }

        // Check if poll is active
        if (!poll.isActive) {
            return res.status(400).json({ error: 'Poll is not active' });
        }

        // Check authentication requirements
        if (poll.requireAuth && !req.user) {
            return res.status(401).json({ error: 'Authentication required for this poll' });
        }

        // Validate selected options
        const validOptionIds = poll.options.map(opt => opt._id.toString());
        const invalidOptions = selectedOptions.filter(optId => !validOptionIds.includes(optId));

        if (invalidOptions.length > 0) {
            return res.status(400).json({ error: 'Invalid option(s) selected' });
        }

        // Check option type constraints
        if (poll.optionType === 'single' && selectedOptions.length > 1) {
            return res.status(400).json({ error: 'Only one option can be selected for this poll' });
        }

        // Check for duplicate votes
        const existingVoteQuery = { poll: pollId };

        if (req.user) {
            existingVoteQuery.voter = req.user._id;
        } else {
            existingVoteQuery.voterIP = voterIP;
            existingVoteQuery.voter = null;
        }
        console.log(existingVoteQuery)

        const existingVote = await Vote.findOne(existingVoteQuery);

        if (existingVote) {
            return res.status(400).json({ error: 'You have already voted in this poll' });
        }

        // Create vote record
        const selectedOptionsData = selectedOptions.map(optId => {
            const option = poll.options.find(opt => opt._id.toString() === optId);
            return {
                optionId: optId,
                optionText: option.text
            };
        });

        const vote = new Vote({
            poll: pollId,
            voter: req.user ? req.user._id : null,
            voterIP,
            selectedOptions: selectedOptionsData,
            userAgent
        });

        await vote.save();

        // Update poll statistics
        const updateOperations = {
            $inc: {
                totalVotes: selectedOptions.length,
                uniqueVoters: 1
            }
        };

        // Update individual option vote counts
        selectedOptions.forEach(optId => {
            updateOperations.$inc[`options.$[elem${optId}].votes`] = 1;
        });

        const arrayFilters = selectedOptions.map(optId => ({
            [`elem${optId}._id`]: optId
        }));

        await Poll.findByIdAndUpdate(
            pollId,
            updateOperations,
            {
                arrayFilters,
                new: true
            }
        );

        // Update user vote count if authenticated
        if (req.user) {
            await User.findByIdAndUpdate(req.user._id, {
                $inc: { votesCount: 1 }
            });
        }

        // Get updated poll for real-time results
        const updatedPoll = await Poll.findById(pollId);
        const results = updatedPoll.getResults();

        // Emit real-time update via Socket.IO
        getIO().to(`poll_${pollId}`).emit('voteUpdate', {
            pollId,
            results,
            newVote: {
                totalVotes: updatedPoll.totalVotes,
                uniqueVoters: updatedPoll.uniqueVoters
            }
        });

        res.status(201).json({
            message: 'Vote submitted successfully',
            results
        });
    } catch (error) {
        console.error('Vote submission error:', error);
        res.status(500).json({ error: error.message });
    }
});



export default {
    submitVote
};