import mongoose from "mongoose";

export const dbConnect = () => {
    mongoose
        .connect(process.env.MONGO)
        .then(() => console.log("DATABASE CONNECTED"))
        .catch((error) => console.error("Database error:", error));
};