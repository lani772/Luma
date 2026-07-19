/**
 * Firmware CRUD REST API
 */
import { Router, type IRouter } from "express";
import { firmwareRepository } from "@workspace/db";
import { gateway } from "../internal-api";

const router: IRouter = Router();

// GET /api/firmware — list all firmware records
router.get("/firmware", async (_req, res) => {
  try {
    const records = await firmwareRepository.findAllFirmware();
    res.json({ firmware: records });
  } catch (err) {
    res.status(500).json({ error: "db_error", message: String(err) });
  }
});

// GET /api/firmware/device/:deviceId — firmware for a specific device
router.get("/firmware/device/:deviceId", async (req, res) => {
  try {
    const records = await firmwareRepository.findFirmwareByDeviceId(req.params["deviceId"]!);
    res.json({ firmware: records });
  } catch (err) {
    res.status(500).json({ error: "db_error", message: String(err) });
  }
});

// POST /api/firmware — register a firmware record
router.post("/firmware", async (req, res) => {
  const body = req.body as {
    id: string;
    deviceId: string;
    version: string;
    checksum: string;
    size: number;
    releaseDate: string;
    stable?: boolean;
  };

  if (!body.id || !body.deviceId || !body.version || !body.checksum) {
    res.status(400).json({
      error: "missing_fields",
      required: ["id", "deviceId", "version", "checksum", "size", "releaseDate"],
    });
    return;
  }

  try {
    const record = await firmwareRepository.upsertFirmware({
      id: body.id,
      deviceId: body.deviceId,
      version: body.version,
      checksum: body.checksum,
      size: body.size,
      releaseDate: body.releaseDate,
      stable: body.stable ?? false,
    });
    res.status(201).json({ firmware: record });
  } catch (err) {
    res.status(500).json({ error: "db_error", message: String(err) });
  }
});

// GET /api/firmware/jobs — list all update jobs
router.get("/firmware/jobs", async (_req, res) => {
  try {
    const jobs = await firmwareRepository.findAllJobs();
    res.json({ jobs });
  } catch (err) {
    res.status(500).json({ error: "db_error", message: String(err) });
  }
});

// GET /api/firmware/jobs/:jobId — get a specific job
router.get("/firmware/jobs/:jobId", async (req, res) => {
  try {
    const job = await firmwareRepository.findJobById(req.params["jobId"]!);
    if (!job) {
      res.status(404).json({ error: "not_found", jobId: req.params["jobId"] });
      return;
    }
    res.json({ job });
  } catch (err) {
    res.status(500).json({ error: "db_error", message: String(err) });
  }
});

// POST /api/firmware/update — trigger an OTA update
router.post("/firmware/update", async (req, res) => {
  const { deviceId, targetVersion, jobId } = req.body as {
    deviceId: string;
    targetVersion: string;
    jobId?: string;
  };

  if (!deviceId || !targetVersion) {
    res.status(400).json({ error: "missing_fields", required: ["deviceId", "targetVersion"] });
    return;
  }

  const id = jobId ?? `job_${Date.now()}_${deviceId}`;

  try {
    // Persist the job
    const job = await firmwareRepository.upsertJob({
      jobId: id,
      deviceId,
      targetVersion,
      status: "pending",
      progress: 0,
    });

    // Trigger the engine
    gateway.sendCommand("firmware_engine", "firmware_engine", "REQUEST_UPDATE", {
      deviceId,
      targetVersion,
      jobId: id,
    }, "high");

    res.status(202).json({ job });
  } catch (err) {
    res.status(500).json({ error: "db_error", message: String(err) });
  }
});

export default router;
