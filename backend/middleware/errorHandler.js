export function errorHandler(err, req, res, next) {
    console.error("Error:", err);

    if (err.name === "ValidationError") {
        const errors = Object.values(err.errors).map((e) => e.message);
        return res.status(400).json({
            success: false,
            message: "Validation failed",
            errors,
        });
    }

    if (err.code === 11000) {
        const field = Object.keys(err.keyPattern)[0];
        return res.status(400).json({
            success: false,
            message: `${field} already exists`,
        });
    }

    if (err.name === "JsonWebTokenError") {
        return res.status(401).json({
            success: false,
            message: "Invalid token",
        });
    }

    res.status(err.status || 500).json({
        success: false,
        message: err.message || "Server error",
        ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
    });
}
