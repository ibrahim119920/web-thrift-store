const User = require("../models/user.js");

const getAuthStatus = (req, res) => {
	res.json({ message: "Auth service is ready" });
};

const register = async (req, res, next) => {
	try {
		const { name, email, password } = req.body;
		if (!name || !email || !password) {
			return res.status(400).json({ message: "name, email, and password are required" });
		}

		if (User.db.readyState !== 1) {
			return res.status(503).json({ message: "Database is not connected" });
		}

		const user = await User.create({ name, email, password });
		res.status(201).json({ id: user._id, name: user.name, email: user.email });
	} catch (error) {
		next(error);
	}
};

const login = async (req, res, next) => {
	try {
		const { email, password } = req.body;
		if (!email || !password) {
			return res.status(400).json({ message: "email and password are required" });
		}

		if (User.db.readyState !== 1) {
			return res.status(503).json({ message: "Database is not connected" });
		}

		const user = await User.findOne({ email });
		if (!user || user.password !== password) {
			return res.status(401).json({ message: "Invalid email or password" });
		}

		res.json({ message: "Login successful", user: { id: user._id, name: user.name, email: user.email } });
	} catch (error) {
		next(error);
	}
};

module.exports = { getAuthStatus, register, login };
