import { Router, type IRouter } from "express";
import healthRouter from "./health";
import sessionRouter from "./session";
import uploadRouter from "./upload";

const router: IRouter = Router();

router.use(healthRouter);
router.use(sessionRouter);
router.use(uploadRouter);

export default router;
