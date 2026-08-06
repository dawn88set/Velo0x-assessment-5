const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const userM = require("../models/users");
const { secretKey } = require("../config/config");

const SALT_ROUNDS = 10;

module.exports = {
  userLogin: async (req, res, next) => {
    try {
      const { emailPhone, password } = req.body || {};

      // The original read req.body.emailPhone directly, which throws when no body
      // was sent (and the body parser was disabled, so that was every request).
      if (!emailPhone || !password) {
        return res.status(400).json({ message: "Provide all Credentials" });
      }

      const loginType = isNaN(emailPhone) ? "email" : "phoneNo";
      const user = await userM.findOne({ [loginType]: emailPhone });

      // Deliberately identical response for "no such user" and "wrong password".
      // The original returned "Invalid Credentials1" vs "Invalid Credentials2",
      // which let an attacker enumerate registered accounts.
      const passMatch = user
        ? await bcrypt.compare(password, user.password)
        : false;

      if (!user || !passMatch) {
        return res.status(401).json({ message: "Invalid Credentials" });
      }

      const jwtData = {
        _id: user._id,
        fname: user.fname,
        lname: user.lname,
        email: user.email,
        isAdmin: user.isAdmin,
      };

      const token = jwt.sign({ user: jwtData }, secretKey, { expiresIn: "1d" });

      res.status(200).json({ message: "Login Successful", token });
    } catch (err) {
      next(err);
    }
  },

  userRegistration: async (req, res, next) => {
    try {
      const { password } = req.body || {};

      if (!password) {
        return res.status(400).json({ message: "Password is required" });
      }

      const hash = await bcrypt.hash(password, SALT_ROUNDS);

      // `users = new userM()` in the original was missing `var` — an implicit
      // global shared across concurrent requests.
      const user = new userM({
        fname: req.body.fname,
        // Was `req.body.lName`. `lname` is required by the schema, so with that
        // casing typo every registration failed validation.
        lname: req.body.lname,
        email: req.body.email,
        phoneNo: req.body.phoneNo,
        state: req.body.state,
        city: req.body.city,
        pincode: req.body.pincode,
        userType: req.body.user_type,
        password: hash,
        createdOn: new Date(),
      });

      const data = await user.save();

      res.status(201).json({ message: "User Added Successfully", id: data._id });
    } catch (err) {
      // Duplicate email / phone number.
      if (err.code === 11000) {
        return res.status(409).json({ message: "User already exists" });
      }
      next(err);
    }
  },

  userList: async (req, res, next) => {
    try {
      const data = await userM.find().select("-password");
      res.status(200).json({ message: "Success", data });
    } catch (err) {
      next(err);
    }
  },

  changePass: async (req, res, next) => {
    try {
      const { _id, password } = req.body || {};

      if (!_id || !password) {
        return res.status(400).json({ message: "Provide user id and password" });
      }

      if (!mongoose.isValidObjectId(_id)) {
        return res.status(400).json({ message: "Invalid user id" });
      }

      const hash = await bcrypt.hash(password, SALT_ROUNDS);
      const result = await userM.updateOne({ _id }, { password: hash });

      if (result.matchedCount === 0) {
        return res.status(404).json({ message: "User not found" });
      }

      res.status(200).json({ message: "Password Changed Successfully", id: _id });
    } catch (err) {
      next(err);
    }
  },
};
