import mongoose, { Schema, Document } from "mongoose";
const mongooseToCsv = require('./to-csv');

export interface IEvent extends Document {
  userId: string;
  eventType: string;
  name: string;
  info: string;
  data: any;
  createdAt: Date;
  updatedAt: Date;
}

const EventSchema: Schema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    eventType: { type: String, required: true, index: true },
    name: { type: String, required: true, index: true },
    info: { type: String, required: false, index: false, default: null },
    data: { type: Schema.Types.Mixed, required: false, default: null }
  },
  {
    timestamps: true,
  }
);

EventSchema.plugin(mongooseToCsv, {
  show_headers: true,
  headers: 'UserId Type Name Info Data Created',
  alias: {
    'UserId': 'userId',
    'Type': 'eventType',
    'Name': 'name',
    'Info': 'info',
    'Created': 'createdAt'
  },
  virtuals: {
    'Data': (record) => {
      return record.data ? JSON.stringify(record.data) : '';
    }
  }
});

export default mongoose.model<IEvent>("Event", EventSchema);
