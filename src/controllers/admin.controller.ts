import { Context } from "https://deno.land/x/oak/mod.ts";
import {AppState, KVMeta} from "../utils/types.ts";
import {kv, memCache} from "../utils/cache.ts";
import {EMAIL, QBIN_ENV, PASTE_STORE} from "../config/constants.ts";
import {PasteError, Response} from "../utils/response.ts";
import {ResponseMessages} from "../utils/messages.ts";
import {parsePagination} from "../utils/validator.ts";
import {createMetadataRepository} from "../db/repositories/metadataRepository.ts";
import {getTimestamp} from "../utils/common.ts";
import { get_all_env } from "../config/env.ts";

type StoredKVMeta = Omit<KVMeta, "fkey" | "name">;

function normalizeStoredKVMeta(meta: Partial<KVMeta> & Record<string, unknown>): StoredKVMeta {
  return {
    email: typeof meta.email === "string" ? meta.email : "",
    title: typeof meta.title === "string" ? meta.title : "",
    uname: typeof meta.uname === "string"
      ? meta.uname
      : typeof meta.name === "string"
      ? meta.name
      : "",
    ip: typeof meta.ip === "string" ? meta.ip : "",
    mime: typeof meta.mime === "string" ? meta.mime : "",
    len: Number(meta.len ?? 0),
    expire: Number(meta.expire ?? 0),
    hash: Number(meta.hash ?? 0),
    pwd: typeof meta.pwd === "string" ? meta.pwd : "",
  };
}

function isSameStoredKVMeta(expected: StoredKVMeta, actual: StoredKVMeta): boolean {
  return expected.email === actual.email
    && expected.title === actual.title
    && expected.uname === actual.uname
    && expected.ip === actual.ip
    && expected.mime === actual.mime
    && expected.len === actual.len
    && expected.expire === actual.expire
    && Number(expected.hash ?? 0) === Number(actual.hash ?? 0)
    && expected.pwd === actual.pwd;
}


export async function syncDBToKV(ctx: Context<AppState>, repo) {
  try {
    const now = getTimestamp();
    const rows = await repo.getActiveMetas();
    const dbMap = new Map<string, StoredKVMeta>();
    for (const r of rows) {
      dbMap.set(r.fkey, normalizeStoredKVMeta({
        email: r.email,
        title: r.title,
        uname: r.uname,
        ip: r.ip,
        mime: r.mime,
        len: r.len,
        expire: r.expire,
        hash: r.hash,
        pwd: r.pwd,
      }));
    }

    const toRemove = [];
    const toUpdate: [string, StoredKVMeta][] = [];
    const toAdd: [string, StoredKVMeta][] = [];
    const kvFkeys = new Set<string>();
    let removed = 0, added = 0, updated = 0, unchanged = 0;

    for await (const entry of kv.list({ prefix: [PASTE_STORE] })) {
      const fkey = entry.key[1] as string;
      const kvVal = normalizeStoredKVMeta((entry.value ?? {}) as Partial<KVMeta> & Record<string, unknown>);
      const dbVal = dbMap.get(fkey);

      // 1. KV 中条目已过期   2. 不存在于数据库（被删除或已过期）
      if (
        kvVal.expire <= now ||
        !dbVal
      ) {
        toRemove.push(entry.key);
      } else {
        kvFkeys.add(fkey);
        if (isSameStoredKVMeta(dbVal, kvVal)) {
          unchanged++;
        } else {
          toUpdate.push([fkey, dbVal]);
        }
      }
    }

    const batchSize = 100;
    for (let i = 0; i < toRemove.length; i += batchSize) {
      const atomic = kv.atomic();
      for (const key of toRemove.slice(i, i + batchSize)) atomic.delete(key);
      await atomic.commit();
      for (const key of toRemove.slice(i, i + batchSize)) {
        memCache.delete(key[1] as string);
      }
      removed += Math.min(batchSize, toRemove.length - i);
    }

    for (const [fkey, meta] of dbMap) {
      if (!kvFkeys.has(fkey)) toAdd.push([fkey, meta]);
    }

    for (let i = 0; i < toAdd.length; i += batchSize) {
      const atomic = kv.atomic();
      for (const [fkey, meta] of toAdd.slice(i, i + batchSize)) {
        atomic.set([PASTE_STORE, fkey], meta);
      }
      await atomic.commit();
      for (const [fkey] of toAdd.slice(i, i + batchSize)) {
        memCache.delete(fkey);
      }
      added += Math.min(batchSize, toAdd.length - i);
    }

    for (let i = 0; i < toUpdate.length; i += batchSize) {
      const atomic = kv.atomic();
      for (const [fkey, meta] of toUpdate.slice(i, i + batchSize)) {
        atomic.set([PASTE_STORE, fkey], meta);
      }
      await atomic.commit();
      for (const [fkey] of toUpdate.slice(i, i + batchSize)) {
        memCache.delete(fkey);
      }
      updated += Math.min(batchSize, toUpdate.length - i);
    }

    return new Response(ctx, 200, ResponseMessages.SUCCESS, {
      stats: { added, updated, removed, unchanged, total: rows.length },
    });
  } catch (error) {
    console.error("同步数据库到 KV 时出错: ", error);
    throw new PasteError(500, ResponseMessages.SERVER_ERROR);
  }
}

export async function getAllStorage(ctx) {
  if(QBIN_ENV === "dev") return new Response(ctx, 403, ResponseMessages.DEMO_RESTRICTED);
  const email = await ctx.state.session?.get("user")?.email;
  if (email !== EMAIL) return new Response(ctx, 403, ResponseMessages.ADMIN_REQUIRED);

  const { page, pageSize } = parsePagination(new URL(ctx.request.url));
  const offset = (page - 1) * pageSize;

  const repo = await createMetadataRepository();
  const { items, total } = await repo.listAlive(pageSize, offset);
  const totalPages = Math.ceil(total / pageSize);

  return new Response(ctx, 200, ResponseMessages.SUCCESS, {
    items,
    pagination: { total, page, pageSize, totalPages },
  });
}

export async function purgeExpiredCacheEntries(ctx){
  const now      = getTimestamp();
  let removed    = 0;   // 被删除的条目
  let kept       = 0;   // 保留下来的条目
  const BATCH_SZ = 100;
  let batch   = kv.atomic();
  let counter = 0;
  for await (const { key, value } of kv.list({ prefix: [] })) {
    const isPasteStore = key[0] === PASTE_STORE;
    const isExpired    = isPasteStore && value?.expire && value.expire < now;
    if (!isPasteStore || isExpired) {
      batch = batch.delete(key);
      removed++;
      counter++;
      if (counter === BATCH_SZ) {
        await batch.commit();
        batch   = kv.atomic();
        counter = 0;
      }
    } else {
      kept++;
    }
  }
  if (counter) {
    await batch.commit();
  }
  return new Response(ctx, 200, ResponseMessages.SUCCESS, {
    removed,
    kept,
  });
}

export async function exportEnv(ctx) {
  if (QBIN_ENV !== "dev") return new Response(ctx, 403, ResponseMessages.FORBIDDEN);
  const email = await ctx.state.session?.get("user")?.email;
  if (email !== EMAIL) return new Response(ctx, 403, ResponseMessages.ADMIN_REQUIRED);

  return new Response(ctx, 200, ResponseMessages.SUCCESS, {
    env: get_all_env(),
  });
}
