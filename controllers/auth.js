import expressAsyncHandler from "express-async-handler";
import User from "../models/user.js";
import { generateToken } from "../config/jwtToken.js";
import crypto from "crypto";
import { createForgotPasswordEmail, sendTwoFactorToken } from "../util/emailService.js";

const createUser = expressAsyncHandler(async (req, res) => {
    const { email } = req.body;

    if (!email) {
        res.status(400);
        throw new Error("Email is required");
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
        res.status(409);
        throw new Error("User with this email already exists");
    }

    const newUser = await User.create(req.body);
    res.status(201).json(newUser);
});

const login = expressAsyncHandler(async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        res.status(400);
        throw new Error("Email and Password are required");
    }

    const findUser = await User.findOne({ email });

    if (findUser && (await findUser.isPasswordMatched(password))) {
        // Generate and send 2FA token
        const token = findUser.generateTwoFactorToken();
        await findUser.save();
        
        // Send 2FA token via email
        await sendTwoFactorToken(findUser, token);

        res.status(200).json({
            message: 'Please check your email for the 2FA verification code',
            requiresTwoFactor: true,
            userId: findUser._id,
        });
    } else {
        res.status(401);
        throw new Error("Invalid Credentials: Check your email and password");
    }
});

const auth = expressAsyncHandler(async (req, res) => {
    const { _id } = req.user;

    try {
        const user = await User.findById(_id);
        if (!user) {
            const error = new Error("user not found!");
            error.statusCode = 404;
            throw error;
        }
        res.status(200).json(user);
    } catch (error) {
        throw new Error(error);
    }
});

export const forgotPasswordToken = expressAsyncHandler(async (req, res) => {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
        const error = new Error("User not found with this email");
        error.statusCode = 404;
        throw error;
    }
    try {
        const token = await user.createPasswordResetToken();
        await user.save();
        await createForgotPasswordEmail(user, token);
        res.json(token);
    } catch (error) {
        throw new Error(error);
    }
});

export const resetPassword = expressAsyncHandler(async (req, res) => {
    const { password, token } = req.body;
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
    const user = await User.findOne({
        passwordResetToken: hashedToken,
        passwordResetExpires: { $gt: Date.now() },
    });
    if (!user) throw new Error(" Token Expired, Please try again later");
    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();
    res.json({ message: "Password Reset Successful" });
});

export const changePassword = expressAsyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
        res.status(400);
        throw new Error("Previous Password and new Password are required");
    }
    const user = req.user;
    const isMatch = await user.isPasswordMatched(currentPassword);
    if (!isMatch) {
        const error = new Error("Current password is incorrect");
        error.statusCode = 400;
        throw error;
    }
    const isNewPasswordSameAsOld = await user.isPasswordMatched(newPassword);
    if (isNewPasswordSameAsOld) {
        const error = new Error(
            "New password cannot be the same as the old password"
        );
        error.statusCode = 400;
        throw error;
    }

    user.password = newPassword;
    await user.save();

    res.json({ message: "Password changed successfully" });
});

export const verifyTwoFactor = expressAsyncHandler(async (req, res) => {
    const { email, token } = req.body;

    if (!email || !token) {
        res.status(400);
        throw new Error("User email and token are required");
    }

    const user = await User.findOne({ email });
    if (!user) {
        res.status(404);
        throw new Error("User not found");
    }

    if (!user.verifyTwoFactorToken(token)) {
        res.status(400);
        throw new Error("Invalid or expired 2FA token");
    }

    // Clear 2FA token and complete login
    user.clearTwoFactorToken();
    user.lastLogin = new Date();
    await user.save();

    res.status(200).json({
        user: user.toJSON(),
        token: generateToken(user._id),
        message: 'Login successful',
    });
});

export const resendTwoFactor = expressAsyncHandler(async (req, res) => {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
        res.status(404);
        throw new Error("User not found");
    }

    if (!user.isPendingTwoFactor) {
        res.status(400);
        throw new Error("User did not request 2FA verification");
    }

    // Generate and send new 2FA token
    const token = user.generateTwoFactorToken();
    await user.save();
    
    // Send 2FA token via email
    await sendTwoFactorToken(user, token);

    res.status(200).json({
        message: 'New 2FA code sent to your email',
    });
});



export default {
    createUser,
    login,
    auth,
    forgotPasswordToken,
    resetPassword,
    changePassword,
    verifyTwoFactor,
    resendTwoFactor,
};