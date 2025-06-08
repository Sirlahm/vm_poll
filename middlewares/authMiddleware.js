import expressAsyncHandler from "express-async-handler";
import User from "../models/user.js";
import jwt from "jsonwebtoken";

export const authMiddleware = expressAsyncHandler(async (req, res, next) => {
    let token;

    // Check if the Authorization header exists and starts with "Bearer"
    if (req?.headers?.authorization?.startsWith("Bearer")) {
        token = req.headers.authorization.split(" ")[1]; // Extract the token

        try {
            if (token) {
                // Verify the token
                const decoded = jwt.verify(token, process.env.JWT_SECRET);

                // Find the user by ID from the decoded token
                const user = await User.findById(decoded?.id).select('-password');

                if (!user) {
                    return res
                        .status(404)
                        .json({ status: "fail", message: "User not found" });
                }

                // Attach the user object to the request
                req.user = user;
                next(); // Proceed to the next middleware/route handler
            }
        } catch (error) {
            // Handle token verification errors
            console.error("Token verification error:", error.message); // Debugging log
            return res
                .status(401)
                .json({
                    status: "fail",
                    message:
                        "Not authorized, token expired or invalid. Please log in again.",
                });
        }
    } else {
        // No token provided
        return res
            .status(401)
            .json({
                status: "fail",
                message: "Unauthenticated! Please provide a valid token.",
            });
    }
});


export const optionalAuth = expressAsyncHandler(async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(' ')[1];

        if (token) {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const user = await User.findById(decoded.userId).select('-password');
            if (user) {
                req.user = user;
            }
        }
        next();
    } catch (error) {
        // Continue without authentication for optional auth
        next();
    }
});