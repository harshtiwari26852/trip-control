const mongoose = require("mongoose");

const planSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Plan must belong to a user"],
      unique: true
    },
    data: {
      type: mongoose.Schema.Types.Mixed,
      required: true
    },
    aiPlan: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    },
    aiSource: {
      type: String,
      default: 'static'
    },
    lastAiRun: {
      type: Date,
      default: null
    },
    weatherData: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    },
    pricingData: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Plan", planSchema);