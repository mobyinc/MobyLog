import dotenv from "dotenv";
dotenv.config();

import express from "express";
import { json } from "body-parser";
import mongoose from "mongoose";
import cors from "cors";
import Event from './event';
import expressBasicAuth from "express-basic-auth";

const port = process.env.PORT ?? 4242;
const mongoUri = process.env.MONGO_URI ?? null;
const app = express();
const router = express.Router();
const basicAuthMiddleware = expressBasicAuth({
  users: { admin: process.env.EXPORT_PASSWORD ?? 'password123!' },
  challenge: true,
});

app.use(cors({ allowedHeaders: "Content-Type,Authorization" }));
app.use(json());
app.use(router);
app.use((err, req, res, next) => {
  res.status(500);
  res.json({ message: "unknown error" });
});


// Connect Database

if (mongoUri) {
  mongoose.connect(mongoUri, {
    useCreateIndex: true,
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
} else {
  throw new Error("MONGO_URI must be set");
}

// Routes

router.get("", (req, res) => {
  // health-check, server is running
  return res.send("hello!");
});

router.post("/events", express.json(), async (req, res) => {
  const event = {
    userId: null,
    eventType: null,
    name: null,
    info: null,
    data: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  Object.assign(event, req.body);

  if (event.userId === null || event.eventType === null || event.name === null) {
    return res.status(400).json({ message: 'bad request' });
  }

  await Event.create(event);

  res.status(201).end();
});

router.get("/export", basicAuthMiddleware, async (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/csv',
    'Content-Disposition': 'attachment; filename=export.csv'
  });

  (Event as any).findAndStreamCsv({}).pipe(res);
});

// Listen

app.listen(port, () => {
  console.log(`server is listening on port ${port}`);
});
