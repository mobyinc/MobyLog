import dotenv from "dotenv";
dotenv.config();

import express from "express";
import { json } from "body-parser";
import mongoose from "mongoose";
import cors from "cors";
import Event from './event';
import expressBasicAuth from "express-basic-auth";
import * as fs from 'fs';
import AdmZip from "adm-zip";
import sgMail = require('@sendgrid/mail');


sgMail.setApiKey(process.env.SENDGRID_API_KEY ?? '')

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
app.set("view engine", "ejs");

app.use('/reports', express.static(__dirname + '/reports'));

app.use((err, req, res, next) => {
  res.status(500);
  res.json({ message: "unknown error" });
});

// Connect Database

if (mongoUri) {
  mongoose.connect(mongoUri);
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
  res.render('export', {
    message: ''
  });
});

router.post("/export", basicAuthMiddleware, express.urlencoded({extended: true}), async (req, res) => {
  const email = req.body.email;
  let message = '';

  if (!email || email.lenngth < 4) {
    message = 'email is required';
  } else {
    message = `The report will be sent to ${email} in the next few minutes.`
    generateReport(email);
  }
  
  res.render('export', {
    message
  });

  // res.writeHead(200, {
  //   'Content-Type': 'text/csv',
  //   'Content-Disposition': 'attachment; filename=export.csv'
  // });

  // Event.find({}).exec().then((docs) => {
  //   (Event as any).csvReadStream(docs).pipe(res);
  // })
});

router.get("/events", basicAuthMiddleware, async (req, res) => {
  const userId = req.query.userId?.toString();
  const eventType = req.query.eventType?.toString();
  const name = req.query.name?.toString();
  const query =  {};

  if (userId === undefined) {
    res.status(400);
    res.json({ error: 'must include userId query parameter' });
    return;
  }

  if (userId !== undefined) query['userId'] = userId;
  if (eventType !== undefined) query['eventType'] = eventType;
  if (name !== undefined) query['name'] = name;

  Event.find(query).exec().then((docs) => {
    res.json(docs);
  }).catch(err => {
    console.log(err);
    res.status(500);
    res.json({ error: err.toString() });
  });
});

// Listen

app.listen(port, () => {
  console.log(`server is listening on port ${port}`);
});

// Generate Report

const generateReport = async (email) => {
  if (!fs.existsSync('tmp')){
    fs.mkdirSync('tmp');
  }

  const docs = await Event.find({}).limit(10).exec();
  const timestamp = new Date().getTime();
  const filename = `report-${timestamp}.csv`;
  const zipFilename = `report-${timestamp}.zip`;
  const path = `tmp/${filename}`;
  const ws = fs.createWriteStream(path);
  
  (Event as any).csvReadStream(docs).pipe(ws);

  await new Promise(resolve => setTimeout(resolve, 1000)); // wait a little bit for file to exist

  var zipFile = new AdmZip();
  zipFile.addLocalFile(`${__dirname}/${path}`);
  zipFile.writeZip(`${__dirname}/reports/${zipFilename}`);

  fs.rmSync(path);

  const url = `${process.env.PUBLIC_URL}/reports/${zipFilename}`;

  const msg = {
    to: email,
    from: 'no-reply@learnortho.io',
    subject: 'Your MobyLog report is ready',
    text: `You may access the report here: ${url}`,
    html: `<p>You may access the report <a href="${url}">here</a></p>`,
  };

  await sgMail.send(msg);

  console.log('done!');
};
