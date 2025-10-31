import jwt from "jsonwebtoken";
import User from "../models/User.js";

export async function authMiddleware(req, res, next) {
    try {
        const token = req.header("Authorization")?.replace("Bearer ", "");

        if (!token) {
            return res.status(401).json({
                success: false,
                message: "No token, authorization denied",
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'chatgpt_clone_secret_key');

        const user = await User.findById(decoded.userId).select("-password");

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "User not found",
            });
        }

        // Store both the user object and a convenient id property
        req.user = {
            id: user._id.toString(),
            _id: user._id,
            email: user.email,
            username: user.username,
        };
        next();
    } catch (error) {
        console.error("Auth middleware error:", error);
        res.status(401).json({
            success: false,
            message: "Token is not valid",
            error: error.message,
        });
    }
}