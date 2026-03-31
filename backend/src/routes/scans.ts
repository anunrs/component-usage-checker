// Scans routes
// POST /scans/upload — accepts a zip file, runs the scan pipeline, saves results to DB
// GET  /scans        — list all scans for the logged-in user
// GET  /scans/:id    — get full component list for one scan

import { Router, Response } from "express";
import multer from "multer";
import fs from "fs";
import { authenticateToken, AuthRequest } from "../middleware/auth";
import prisma from "../lib/prisma";
import { extractZip } from "../services/zipExtractor";
import { buildUsageMap } from "../services/usageBuilder";
import { buildReachabilitySet } from "../services/graphBuilder";

const router = Router();

// Protect all routes in this file
router.use(authenticateToken);

// Multer config: save to /tmp — works on both local and Vercel serverless
const storage = multer.diskStorage({
  destination: "/tmp",
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${file.originalname}`;
    cb(null, unique);
  },
});

const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "application/zip" || file.originalname.endsWith(".zip")) {
      cb(null, true);
    } else {
      cb(new Error("Only .zip files are allowed"));
    }
  },
});

// POST /scans/upload
router.post(
  "/upload",
  upload.single("zipFile"),
  async (req: AuthRequest, res: Response): Promise<void> => {
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }

    const projectName = (req.body.projectName as string) || "Untitled Project";

    // Create a scan record with status "pending"
    const scan = await prisma.scan.create({
      data: {
        userId: req.userId!,
        projectName,
        status: "pending",
      },
    });

    try {
      // Run the scan pipeline
      const files = extractZip(req.file.path);
      const reachableFiles = buildReachabilitySet(files);
      const components = buildUsageMap(files, reachableFiles);

      // Save each component to the DB
      await prisma.component.createMany({
        data: components.map((c) => ({
          scanId: scan.id,
          name: c.name,
          definedIn: c.definedIn,
          usageCount: c.usageCount,
          usedIn: c.usedIn,
          reachable: c.reachable,
        })),
      });

      // Mark scan as complete
      await prisma.scan.update({
        where: { id: scan.id },
        data: { status: "complete" },
      });

      // Clean up the uploaded zip file
      fs.unlinkSync(req.file.path);

      res.status(201).json({ scanId: scan.id });
    } catch (err) {
      await prisma.scan.update({
        where: { id: scan.id },
        data: { status: "failed" },
      });
      res.status(500).json({ error: "Scan failed" });
    }
  }
);

// GET /scans
router.get("/", async (req: AuthRequest, res: Response): Promise<void> => {
  const scans = await prisma.scan.findMany({
    where: { userId: req.userId! },
    orderBy: { createdAt: "desc" },
  });
  res.json(scans);
});

// GET /scans/:id
router.get("/:id", async (req: AuthRequest, res: Response): Promise<void> => {
  const scan = await prisma.scan.findFirst({
    where: { id: req.params.id as string, userId: req.userId! },
    include: { components: true },
  });

  if (!scan) {
    res.status(404).json({ error: "Scan not found" });
    return;
  }

  res.json(scan);
});

export default router;
