import { Router, type IRouter } from "express";
import healthRouter from "./health";
import enginesRouter from "./engines";

const router: IRouter = Router();

router.use(healthRouter);
router.use(enginesRouter);

export default router;
