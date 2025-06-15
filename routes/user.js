import express from "express";
import { body, validationResult, param } from 'express-validator';
import userController from "../controllers/user.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { uploadMiddleware } from "../middlewares/uploadMiddleware.js";


const router = express.Router();

router.put('/', authMiddleware, uploadMiddleware.fields([
    { name: 'avatar', maxCount: 1 },
    { name: 'logo', maxCount: 1 }
]), userController.editUserProfile)





export default router;
