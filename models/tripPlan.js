const mongoose = require('mongoose');

// Persisted TripWise plan: the user's submitted inputs, the generated calendar
// response and any cached trip details, together with the last update time.
const tripPlanSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Plan must belong to a user'],
      index: true
    },
    inputs: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    },
    calendar: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    },
    cachedDetails: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    updatedAt: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('TripPlan', tripPlanSchema);