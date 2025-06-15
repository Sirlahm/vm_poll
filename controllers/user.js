import User from "../models/user.js";
import { uploadToCloudinary } from "../util/uploadCloudinary.js";

export const editUserProfile = async (req, res) => {
    try {
        const userId = req.user._id;
        const updateData = {
            ...req.body,
        };


        // Handle avatar upload
        if (req.files?.avatar?.[0]) {
            const avatarUpload = await uploadToCloudinary(
                req.files.avatar[0].path,
                `users-avatar-images`
            );
            updateData.avatar = avatarUpload;
        }

        // Handle logo upload
        if (req.files?.logo?.[0]) {
            const logoUpload = await uploadToCloudinary(
                req.files.logo[0].path,
                `users-logo-images`
            );
            updateData.logo = logoUpload;
        }

        const updatedUser = await User.findByIdAndUpdate(userId, updateData, {
            new: true,
            select: "-password",
        });

        res.status(200).json({
            success: true,
            message: "Profile updated successfully",
            user: updatedUser,
        });
    } catch (error) {
        throw new Error(error);

    }
};


export default {
    editUserProfile
}