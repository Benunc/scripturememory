var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// .wrangler/tmp/bundle-AT8gsF/checked-fetch.js
var urls = /* @__PURE__ */ new Set();
function checkURL(request, init) {
  const url = request instanceof URL ? request : new URL(
    (typeof request === "string" ? new Request(request, init) : request).url
  );
  if (url.port && url.port !== "443" && url.protocol === "https:") {
    if (!urls.has(url.toString())) {
      urls.add(url.toString());
      console.warn(
        `WARNING: known issue with \`fetch()\` requests to custom HTTPS ports in published Workers:
 - ${url.toString()} - the custom port will be ignored when the Worker is published using the \`wrangler deploy\` command.
`
      );
    }
  }
}
__name(checkURL, "checkURL");
globalThis.fetch = new Proxy(globalThis.fetch, {
  apply(target, thisArg, argArray) {
    const [request, init] = argArray;
    checkURL(request, init);
    return Reflect.apply(target, thisArg, argArray);
  }
});

// .wrangler/tmp/bundle-AT8gsF/strip-cf-connecting-ip-header.js
function stripCfConnectingIPHeader(input, init) {
  const request = new Request(input, init);
  request.headers.delete("CF-Connecting-IP");
  return request;
}
__name(stripCfConnectingIPHeader, "stripCfConnectingIPHeader");
globalThis.fetch = new Proxy(globalThis.fetch, {
  apply(target, thisArg, argArray) {
    return Reflect.apply(target, thisArg, [
      stripCfConnectingIPHeader.apply(null, argArray)
    ]);
  }
});

// ../node_modules/itty-router/index.mjs
var e = /* @__PURE__ */ __name(({ base: e2 = "", routes: t = [], ...o2 } = {}) => ({ __proto__: new Proxy({}, { get: (o3, s2, r, n) => "handle" == s2 ? r.fetch : (o4, ...a) => t.push([s2.toUpperCase?.(), RegExp(`^${(n = (e2 + o4).replace(/\/+(\/|$)/g, "$1")).replace(/(\/?\.?):(\w+)\+/g, "($1(?<$2>*))").replace(/(\/?\.?):(\w+)/g, "($1(?<$2>[^$1/]+?))").replace(/\./g, "\\.").replace(/(\/?)\*/g, "($1.*)?")}/*$`), a, n]) && r }), routes: t, ...o2, async fetch(e3, ...o3) {
  let s2, r, n = new URL(e3.url), a = e3.query = { __proto__: null };
  for (let [e4, t2] of n.searchParams)
    a[e4] = a[e4] ? [].concat(a[e4], t2) : t2;
  for (let [a2, c2, i2, l2] of t)
    if ((a2 == e3.method || "ALL" == a2) && (r = n.pathname.match(c2))) {
      e3.params = r.groups || {}, e3.route = l2;
      for (let t2 of i2)
        if (null != (s2 = await t2(e3.proxy ?? e3, ...o3)))
          return s2;
    }
} }), "e");
var o = /* @__PURE__ */ __name((e2 = "text/plain; charset=utf-8", t) => (o2, { headers: s2 = {}, ...r } = {}) => void 0 === o2 || "Response" === o2?.constructor.name ? o2 : new Response(t ? t(o2) : o2, { headers: { "content-type": e2, ...s2.entries ? Object.fromEntries(s2) : s2 }, ...r }), "o");
var s = o("application/json; charset=utf-8", JSON.stringify);
var c = o("text/plain; charset=utf-8", String);
var i = o("text/html");
var l = o("image/jpeg");
var p = o("image/png");
var d = o("image/webp");

// src/auth/token.ts
var generateToken = /* @__PURE__ */ __name(async () => {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array).map((b) => b.toString(16).padStart(2, "0")).join("");
}, "generateToken");

// src/auth/index.ts
var RATE_LIMIT = 5;
var rateLimits = /* @__PURE__ */ new Map();
var isRateLimited = /* @__PURE__ */ __name((email) => {
  const now = Date.now();
  const userRequests = rateLimits.get(email) || [];
  const recentRequests = userRequests.filter((time) => now - time < 6e4);
  rateLimits.set(email, recentRequests);
  return recentRequests.length >= RATE_LIMIT;
}, "isRateLimited");
var recordRequest = /* @__PURE__ */ __name((email) => {
  const now = Date.now();
  const userRequests = rateLimits.get(email) || [];
  userRequests.push(now);
  rateLimits.set(email, userRequests);
}, "recordRequest");
var handleAuth = {
  // Send magic link
  sendMagicLink: async (request, env) => {
    try {
      const { email } = await request.json();
      if (!email) {
        return new Response("Email is required", { status: 400 });
      }
      if (isRateLimited(email)) {
        return new Response("Too many requests. Please try again later.", { status: 429 });
      }
      recordRequest(email);
      const token = await generateToken();
      const expiresAt = Date.now() + 15 * 60 * 1e3;
      await env.DB.prepare(
        "INSERT INTO magic_links (token, email, expires_at) VALUES (?, ?, ?)"
      ).bind(token, email, expiresAt).run();
      return new Response(JSON.stringify({ token }), {
        headers: { "Content-Type": "application/json" }
      });
    } catch (error) {
      console.error("Error sending magic link:", error);
      return new Response("Internal Server Error", { status: 500 });
    }
  },
  // Verify magic link
  verifyMagicLink: async (request, env) => {
    try {
      console.log("=== Starting token verification ===");
      const url = new URL(request.url);
      const token = url.searchParams.get("token");
      console.log("Received token:", token);
      console.log("Current timestamp:", Date.now());
      if (!token) {
        console.log("No token provided");
        return new Response("Token is required", { status: 400 });
      }
      console.log("Querying database for token...");
      const result = await env.DB.prepare(
        "SELECT * FROM magic_links WHERE token = ? AND expires_at > ?"
      ).bind(token, Date.now()).first();
      console.log("Database query result:", result);
      if (!result) {
        console.log("Token not found or expired");
        return new Response("Invalid or expired token", { status: 401 });
      }
      console.log("Token found, generating session...");
      await env.DB.prepare(
        "DELETE FROM magic_links WHERE token = ?"
      ).bind(token).run();
      const sessionToken = await generateToken();
      const expiresAt = Date.now() + 24 * 60 * 60 * 1e3;
      await env.DB.prepare(
        "INSERT INTO sessions (token, email, expires_at) VALUES (?, ?, ?)"
      ).bind(sessionToken, result.email, expiresAt).run();
      console.log("Session created successfully");
      return new Response(JSON.stringify({
        token: sessionToken,
        email: result.email
      }), {
        headers: { "Content-Type": "application/json" }
      });
    } catch (error) {
      console.error("Error in verifyMagicLink:", error);
      return new Response("Internal Server Error", { status: 500 });
    }
  }
};

// src/verses/index.ts
var getUserEmail = /* @__PURE__ */ __name(async (token, env) => {
  const result = await env.DB.prepare(
    "SELECT email FROM sessions WHERE token = ? AND expires_at > ?"
  ).bind(token, Date.now()).first();
  return result?.email || null;
}, "getUserEmail");
var handleVerses = {
  // Get all verses for a user
  getVerses: async (request, env) => {
    try {
      const authHeader = request.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return new Response("Unauthorized", { status: 401 });
      }
      const token = authHeader.split(" ")[1];
      const email = await getUserEmail(token, env);
      if (!email) {
        return new Response("Invalid or expired session", { status: 401 });
      }
      const verses = await env.DB.prepare(
        "SELECT * FROM verses WHERE email = ? ORDER BY created_at DESC"
      ).bind(email).all();
      return new Response(JSON.stringify(verses.results), {
        headers: { "Content-Type": "application/json" }
      });
    } catch (error) {
      console.error("Error getting verses:", error);
      return new Response("Internal Server Error", { status: 500 });
    }
  },
  // Add a new verse
  addVerse: async (request, env) => {
    try {
      const authHeader = request.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return new Response("Unauthorized", { status: 401 });
      }
      const token = authHeader.split(" ")[1];
      const email = await getUserEmail(token, env);
      if (!email) {
        return new Response("Invalid or expired session", { status: 401 });
      }
      const verse = await request.json();
      if (!verse.reference || !verse.text) {
        return new Response("Reference and text are required", { status: 400 });
      }
      await env.DB.prepare(
        "INSERT INTO verses (email, reference, text, translation, created_at) VALUES (?, ?, ?, ?, ?)"
      ).bind(
        email,
        verse.reference,
        verse.text,
        verse.translation || "NIV",
        Date.now()
      ).run();
      return new Response(JSON.stringify({ success: true }), {
        headers: { "Content-Type": "application/json" }
      });
    } catch (error) {
      console.error("Error adding verse:", error);
      return new Response("Internal Server Error", { status: 500 });
    }
  },
  // Update a verse
  updateVerse: async (request, env) => {
    try {
      const authHeader = request.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return new Response("Unauthorized", { status: 401 });
      }
      const token = authHeader.split(" ")[1];
      const email = await getUserEmail(token, env);
      if (!email) {
        return new Response("Invalid or expired session", { status: 401 });
      }
      const url = new URL(request.url);
      const reference = decodeURIComponent(url.pathname.split("/").pop() || "");
      if (!reference) {
        return new Response("Verse reference is required", { status: 400 });
      }
      const verse = await request.json();
      if (!verse.text) {
        return new Response("Text is required", { status: 400 });
      }
      const existing = await env.DB.prepare(
        "SELECT * FROM verses WHERE reference = ? AND email = ?"
      ).bind(reference, email).first();
      if (!existing) {
        return new Response("Verse not found or unauthorized", { status: 404 });
      }
      await env.DB.prepare(
        "UPDATE verses SET text = ?, translation = ? WHERE reference = ? AND email = ?"
      ).bind(
        verse.text,
        verse.translation || "NIV",
        reference,
        email
      ).run();
      return new Response(null, { status: 204 });
    } catch (error) {
      console.error("Error updating verse:", error);
      return new Response("Internal Server Error", { status: 500 });
    }
  },
  // Delete a verse
  deleteVerse: async (request, env) => {
    try {
      const authHeader = request.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return new Response("Unauthorized", { status: 401 });
      }
      const token = authHeader.split(" ")[1];
      const email = await getUserEmail(token, env);
      if (!email) {
        return new Response("Invalid or expired session", { status: 401 });
      }
      const url = new URL(request.url);
      const reference = decodeURIComponent(url.pathname.split("/").pop() || "");
      if (!reference) {
        return new Response("Verse reference is required", { status: 400 });
      }
      const existing = await env.DB.prepare(
        "SELECT * FROM verses WHERE reference = ? AND email = ?"
      ).bind(reference, email).first();
      if (!existing) {
        return new Response("Verse not found or unauthorized", { status: 404 });
      }
      await env.DB.prepare(
        "DELETE FROM verses WHERE reference = ? AND email = ?"
      ).bind(reference, email).run();
      return new Response(null, { status: 204 });
    } catch (error) {
      console.error("Error deleting verse:", error);
      return new Response("Internal Server Error", { status: 500 });
    }
  }
};

// src/index.ts
var router = e();
var corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};
router.options("*", () => new Response(null, { headers: corsHeaders }));
router.post("/auth/magic-link", handleAuth.sendMagicLink);
router.get("/auth/verify", handleAuth.verifyMagicLink);
router.get("/verses", handleVerses.getVerses);
router.post("/verses", handleVerses.addVerse);
router.put("/verses/:reference", handleVerses.updateVerse);
router.delete("/verses/:reference", handleVerses.deleteVerse);
router.all("*", () => new Response("Not Found", { status: 404 }));
var src_default = {
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: corsHeaders
      });
    }
    try {
      const response = await router.handle(request, env, ctx);
      Object.entries(corsHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      return response;
    } catch (error) {
      console.error("Error handling request:", error);
      return new Response("Internal Server Error", { status: 500 });
    }
  }
};

// node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e2) {
      console.error("Failed to drain the unused request body.", e2);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e2) {
  return {
    name: e2?.name,
    message: e2?.message ?? String(e2),
    stack: e2?.stack,
    cause: e2?.cause === void 0 ? void 0 : reduceError(e2.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e2) {
    const error = reduceError(e2);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-AT8gsF/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = src_default;

// node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-AT8gsF/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof __Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
__name(__Facade_ScheduledController__, "__Facade_ScheduledController__");
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = (request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    };
    #dispatcher = (type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    };
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
