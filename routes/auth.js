import authController from "../controllers/auth.js";
import express from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";


const router = express.Router();
router.post("/register", authController.createUser);
router.post("/login", authController.login);
router.post("/verify-2fa", authController.verifyTwoFactor);
router.post("/resend-2fa", authController.resendTwoFactor);
router.get("/", authMiddleware, authController.auth);
router.post("/change-password", authMiddleware, authController.changePassword);
router.post("/forget-password", authController.forgotPasswordToken);
router.post("/reset-password", authController.resetPassword);

export default router;
