// Express app entry point
// app.listen() only runs locally — on Vercel the app is exported and Vercel handles the listening.

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import authRoutes from "./routes/auth";
import scanRoutes from "./routes/scans";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",")
  : ["http://localhost:3001"];

app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

app.use("/auth", authRoutes);
app.use("/scans", scanRoutes);

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Local development only
if (process.env.NODE_ENV !== "production") {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

export default app;
