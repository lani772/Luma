import { Router, type IRouter } from "express";
import healthRouter from "./health";
import enginesRouter from "./engines";
import devicesRouter from "./devices";
import firmwareRouter from "./firmware";

const router: IRouter = Router();

router.use(healthRouter);
router.use(enginesRouter);
router.use(devicesRouter);
router.use(firmwareRouter);

export default router;
