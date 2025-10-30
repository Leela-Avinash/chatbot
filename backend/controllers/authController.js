import jwt from "jsonwebtoken";
import User from "../models/User.js";

export async function register(req, res) {
    try {
        const { email, username, password } = req.body;

        if (!email || !username || !password) {
            return res.status(400).json({
                success: false,
                message: "Please provide all required fields",
            });
        }

        // if (password.length < 6) {
        //     return res.status(400).json({
        //         success: false,
        //         message: "Password must be at least 6 characters",
        //     });
        // }

        // Check if user already exists
        const existingUser = await User.findOne({
            $or: [{ email }, { username }],
        });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: "User already exists with this email or username",
            });
        }

        const user = await User.create({ email, username, password });

        const token = jwt.sign(
            { userId: user._id, email: user.email },
            process.env.JWT_SECRET || 'chatgpt_clone_secret_key',
            { expiresIn: process.env.JWT_EXPIRES_IN || "15d" }
        );

        res.status(201).json({
            success: true,
            message: "User registered successfully",
            token,
            user: {
                id: user._id,
                email: user.email,
                username: user.username,
            },
        });
    } catch (error) {
        console.error("Register error:", error);
        res.status(500).json({
            success: false,
            message: "Error registering user",
            error: error.message,
        });
    }
}

export async function login(req, res) {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Please provide email and password",
            });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Invalid credentials",
            });
        }

        const isPasswordValid = await user.comparePassword(password);
        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: "Invalid credentials",
            });
        }

        const token = jwt.sign(
            { userId: user._id, email: user.email },
            process.env.JWT_SECRET || 'chatgpt_clone_secret_key',
            { expiresIn: process.env.JWT_EXPIRES_IN || "15d" }
        );

        res.json({
            success: true,
            message: "Login successful",
            token,
            user: {
                id: user._id,
                email: user.email,
                username: user.username,
            },
        });
    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({
            success: false,
            message: "Error logging in",
            error: error.message,
        });
    }
}

export async function getMe(req, res) {
    try {
        // req.user is already populated by authMiddleware with the necessary fields
        res.json({
            success: true,
            user: {
                id: req.user.id,
                email: req.user.email,
                username: req.user.username,
            },
        });
    } catch (error) {
        console.error("Get me error:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching user data",
            error: error.message,
        });
    }
}
