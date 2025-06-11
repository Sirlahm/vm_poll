import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';
import { configDotenv } from "dotenv";

configDotenv();



cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const uploadToCloudinary = async (filePath, folder) => {
    try {
        const result = await cloudinary.uploader.upload(filePath, {
            folder: `polls/${folder}`,
            resource_type: 'auto'
        });

        // Delete local file after upload
        fs.unlinkSync(filePath);

        return {
            url: result.secure_url,
            publicId: result.public_id
        };
    } catch (error) {
        // Delete local file even if upload fails
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
        throw error;
    }
};