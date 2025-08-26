// app.js — minimal presigner
import express from "express";
import crypto from "node:crypto";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const app = express();
app.use(express.json());

const {
  AWS_REGION,
  BUCKET_NAME,
  URL_TTL_SECONDS = "900",
} = process.env;

const s3 = new S3Client({ region: AWS_REGION });

function sanitize(s, max = 64) {
  return String(s || "").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, max);
}

app.get("/presign", async (req, res) => {
  try {
    const now = new Date().toISOString().replace(/[:.]/g, "-");
    const device  = sanitize(req.query.device || "device");
    const session = sanitize(req.query.session || crypto.randomUUID());
    const seq     = String(parseInt(req.query.seq || "1", 10)).padStart(4, "0");

    const key = `sessions/${session}/${now}__${device}__P${seq}.wav`;

    const cmd = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      ContentType: "audio/wav"
    });

    const url = await getSignedUrl(s3, cmd, { expiresIn: parseInt(URL_TTL_SECONDS, 10) });
    res.json({ url, bucket: BUCKET_NAME, key, contentType: "audio/wav" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "presign_failed" });
  }
});

app.get("/", (req, res) => res.send("ok"));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log("Presigner up on :" + port));
