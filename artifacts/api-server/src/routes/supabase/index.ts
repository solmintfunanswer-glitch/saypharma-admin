import { Router, type IRouter } from "express";
import settingsRouter from "./settings";
import productsRouter from "./products";
import ordersRouter from "./orders";
import stockMovementsRouter from "./stock-movements";
import stockBalanceRouter from "./stock-balance";
import stockReportRouter from "./stock-report";
import resetRouter from "./reset";
import callTranscriptsRouter from "./call-transcripts";

const router: IRouter = Router();

router.use(settingsRouter);
router.use(productsRouter);
router.use(ordersRouter);
router.use(stockMovementsRouter);
router.use(stockBalanceRouter);
router.use(stockReportRouter);
router.use(resetRouter);
router.use(callTranscriptsRouter);

export default router;
