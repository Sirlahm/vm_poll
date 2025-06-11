import express from "express";
import { body, validationResult, param } from 'express-validator';
import pollController from "../controllers/poll.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { uploadMiddleware } from "../middlewares/uploadMiddleware.js";

const router = express.Router();

router.post('/', authMiddleware, uploadMiddleware.any(), pollController.createPoll)
router.get('/', authMiddleware, pollController.getPolls)
router.get('/:shareCode', authMiddleware, pollController.getPollByShareCode)
router.get('/:id/results', pollController.getResult)
router.get('/my-polls', authMiddleware, pollController.getMyPolls)
router.put('/', authMiddleware, pollController.updatePoll)
router.delete('/', authMiddleware, pollController.deletePoll)





export default router;




// [
//     body('title').isLength({ min: 1, max: 200 }).trim(),
//     body('description').optional().isLength({ max: 1000 }).trim(),
//     body('optionType').isIn(['single', 'multiple']),
//     body('options').isArray({ min: 2, max: 10 }),
//     body('options.*.text').isLength({ min: 1, max: 200 }).trim(),
//     // body('endDate').isISO8601().toDate(),
//     // body('allowAnonymous').optional().isBoolean(),
//     // body('requireAuth').optional().isBoolean(),
//     // body('isPublic').optional().isBoolean(),
//     // body('tags').optional().isArray({ max: 5 })
// ],