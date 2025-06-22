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
        accountType: {
            type: String,
            required: true,
            enum: ["personal", "organisation"],
        },
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
        companyType: String,
        companyName: String,
        jobTitle: String,
        numberofPollsPerYear: Number,
        numberofVoters: Number,
        passwordResetToken: String,
        passwordResetExpires: Date,
        logo: String,
        color: String,

        isAdmin: {
            type: Boolean,
            default: false,
        },
        lastLogin: { type: Date },
        twoFactorToken: String,
        twoFactorTokenExpires: Date,
        isPendingTwoFactor: {
            type: Boolean,
            default: false,
        },
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
    this.passwordResetExpires = Date.now() + 60 * 60 * 1000; 
    return resettoken;
};

userSchema.methods.generateTwoFactorToken = function () {
    const token = Math.floor(100000 + Math.random() * 900000).toString();
    this.twoFactorToken = token;
    this.twoFactorTokenExpires = Date.now() + 10 * 60 * 1000; 
    this.isPendingTwoFactor = true;
    return token;
};

userSchema.methods.verifyTwoFactorToken = function (token) {
    return this.twoFactorToken === token && 
           this.twoFactorTokenExpires > Date.now() && 
           this.isPendingTwoFactor;
};

userSchema.methods.clearTwoFactorToken = function () {
    this.twoFactorToken = undefined;
    this.twoFactorTokenExpires = undefined;
    this.isPendingTwoFactor = false;
};

export default mongoose.model("User", userSchema);
