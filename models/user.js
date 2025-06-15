import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const userSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            lowercase: true,
        },
        email: {
            type: String,
            required: true,
            lowercase: true,
            unique: true,
        },
        password: {
            type: String,
            required: true,
        },
        // accountType: {
        //     type: String,
        //     required: true,
        //     enum: ["institution", "organization"],
        // },
        avatar: {
            url: String,
            publicId: String
        },
        logo: {
            url: String,
            publicId: String
        },
        pollsCreated: {
            type: Number,
            default: 0
        },
        passwordResetToken: String,
        passwordResetExpires: Date,
        logo: String,
        color: String,

        isAdmin: {
            type: Boolean,
            default: false,
        },
        lastLogin: { type: Date },
        otp: String,
        otpExpires: Date,
    },
    {
        timestamps: true,
    }
);

userSchema.pre("save", async function (next) {
    if (!this.isModified("password")) {
        next();
    }
    const salt = await bcrypt.genSaltSync(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});
userSchema.methods.isPasswordMatched = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

userSchema.methods.toJSON = function () {
    const user = this.toObject();
    delete user.password;
    return user;
};

userSchema.methods.createPasswordResetToken = async function () {
    const resettoken = crypto.randomBytes(32).toString("hex");
    this.passwordResetToken = crypto
        .createHash("sha256")
        .update(resettoken)
        .digest("hex");
    this.passwordResetExpires = Date.now() + 60 * 60 * 1000; // 60 minutes
    return resettoken;
};

export default mongoose.model("User", userSchema);
