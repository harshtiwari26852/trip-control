const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
 firstName : {
  type : String,
  required : [true, 'First Name is required']
 },
 lastName : {
  type : String,
  required : [true, 'last Name is required']
 },
 email : {
  type : String,
  required : [true, 'Email is required'],
  unique : true
 },
 password : {
  type : String,
  required : [true, 'password is required']
 }
});

module.exports = mongoose.model('User',userSchema);