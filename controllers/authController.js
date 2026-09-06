const { check, validationResult } = require("express-validator");
const bcrypt = require('bcryptjs');
const User = require("../models/user");

exports.getLogin = (req,res,next)=>{
  res.render('auth/login', { errors: [], oldInput: {} });
}

exports.postLogin = (req,res,next)=>{
  const {email, password} = req.body;

  User.findOne({email})
    .then(user => {
      if (!user) {
        return res.status(422).render("auth/login", {
          errors : ["Invalid email or password."],
          oldInput : {email}
        });
      }

      bcrypt.compare(password, user.password)
        .then(match => {
          if (!match) {
            return res.status(422).render("auth/login", {
              errors : ["Invalid email or password."],
              oldInput : {email}
            });
          }

          req.session.regenerate((err) => {
            if (err) return next(err);

            req.session.isLoggedIn = true;
            req.session.user = {
              _id: user._id.toString(),
              firstName: user.firstName,
              lastName: user.lastName,
              email: user.email
            };
            return req.session.save(err => {
              if (err) return next(err);
              res.redirect('/');
            });
          });
        })
        .catch(next);
    })
    .catch(next);
}

exports.postLogout = (req, res, next) =>{
  req.session.destroy((error) => {
    if (error) return next(error);
    res.clearCookie('connect.sid');
    res.redirect('/login');
  });
};

exports.getSignup = (req,res,next)=>{
  res.render('auth/signup', {
    errors: [],
    oldInput: {},
  });
}

exports.postSignup =[
  check("firstName")
  .trim()
  .notEmpty()
  .withMessage("First name is required")
  .isLength({min : 2})
  .withMessage("First name should be at least 2 characters long")
  .matches(/^[A-Za-z\s]+$/)
  .withMessage("First name should contain only alphabets"),

   check("lastName")
  .trim()
  .notEmpty()
  .withMessage("Last name is required")
  .isLength({min : 2})
  .withMessage("Last name should be at least 2 characters long")
  .matches(/^[A-Za-z\s]+$/)
  .withMessage("Last name should contain only alphabets"),

  check("email")
  .trim()
  .notEmpty()
  .withMessage("Email is required")
  .isEmail()
  .withMessage("Please enter a valid email address")
  .normalizeEmail(),

  check("password")
  .isString()
  .withMessage("Password must be a valid value")
  .notEmpty()
  .withMessage("Password is required")
  .isLength({ min: 8 })
  .withMessage("Password must be at least 8 characters long")
  .matches(/^(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s]).+$/)
  .withMessage("Password must include at least one uppercase letter, one number, and one special character"),

  check("confirmPassword")
  .notEmpty()
  .withMessage("Please confirm your password")
  .custom((value, { req }) => value === req.body.password)
  .withMessage("Passwords do not match"),

  check("terms")
  .equals("on")
  .withMessage("You must agree to the terms and conditions"),

  (req,res) =>{
    const {firstName,lastName, email, password } = req.body;
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(422).render("auth/signup", {
      errors: errors.array().map(err => err.msg),
      oldInput : {firstName,lastName,email,password}
    });
  }

  User.findOne({email})
    .then(existingUser => {
      if (existingUser) {
        return res.status(422).render("auth/signup", {
          errors : ["An account with that email already exists. Please log in."],
          oldInput : {firstName,lastName,email,password}
        });
      }
      return bcrypt.hash(password, 12).then(hashedPassword =>{
        const user = new User({firstName,lastName, email, password : hashedPassword});
        return user.save();
      });
    })
    .then(() =>{
      res.redirect("/login");
    })
    .catch(err =>{
      if (err.code === 11000) {
        return res.status(422).render("auth/signup", {
          errors : ["An account with that email already exists. Please log in."],
          oldInput : {firstName,lastName,email,password}
        });
      }
      return res.status(422).render("auth/signup", {
        errors: [err.message],
        oldInput : {firstName,lastName,email,password}
      });
    });
}]