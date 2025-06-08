import express from "express";
import { body, validationResult, param } from 'express-validator';
import voteController from "../controllers/voteController.js";
import { optionalAuth } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.post('/:pollId', optionalAuth, [
    param('pollId').isMongoId(),
    body('selectedOptions').isArray({ min: 1 }),
    body('selectedOptions.*').isMongoId()
], voteController.submitVote)





export default router;
