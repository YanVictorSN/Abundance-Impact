import mongoose from 'mongoose';

const circleSchema = new mongoose.Schema({
  fid: Number,
  time: String,
  channels: { type: [String], default: [] },
  curators: { type: [Number], default: [] },
  points: String,
  text: String,
  username: String,
  ecosystem: String,
  referrer: Number,
  circles: { type: [String], default: [] },
  showcase: [
    {
      cast: { type: String, default: null },
      circle: { type: String, default: null },
      username: { type: String, default: null }
    },
  ],
  createdAt: { type: Date, default: () => new Date() },
});

const Circle = mongoose.models.Circle || mongoose.model('Circle', circleSchema);

export default Circle;
