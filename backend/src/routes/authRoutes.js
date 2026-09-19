const express = require("express");
const {
	getAuthStatus,
	register,
	login,
} = require("../controllers/authControllers.js");

const router = express.Router();

router.get("/", getAuthStatus);
router.post("/register", register);
router.post("/login", login);

module.exports = router;
