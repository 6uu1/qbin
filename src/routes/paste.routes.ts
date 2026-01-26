import { Router } from "https://deno.land/x/oak/mod.ts";
import {
  getRaw,
  save,
  remove,
} from "../controllers/paste.controller.ts";

const router = new Router();

router
  .get("/r/:key/:pwd?", getRaw)
  .post("/save/:key?/:pwd?", save)
  .put("/save/:key?/:pwd?", save)
  .delete("/delete/:key/:pwd?", remove);

export default router;
