// OpenTelemetry for the platform's Edge Functions — traces + sanitized logs,
// shipped to the Bluebox environment. Roadmap H8; design and the owner's
// decisions live in docs/plans/bluebox-observability.md.
//
// THE RULE THIS FILE EXISTS TO ENFORCE (ARCHITECTURE.md invariant 3): a span
// carries an **allow-list** of attributes, never a deny-list. These functions
// handle invite emails, user administration, and WebAuthn material, so the
// module exposes no way to attach free text to a span: `report()` takes the
// fixed `Facts` shape below and nothing else. Adding a field is a decision, not
// a convenience — an error *message* can embed an email (admin-invite surfaces
// `inviteErr.message` verbatim), which is why only the error's class and a
// charset-restricted code are ever recorded.
//
// The allow-list is enforced HERE, not at the call sites. An earlier draft typed
// the fields as plain `string` and exported a `safeCode()` that every error site
// had to remember to call — which meant one forgotten wrapper silently defeated
// the invariant, and the value also reached the span *name*. Now `sanitize()`
// below gates every value on its way onto the span, so a call site that passes
// something unexpected loses the attribute rather than leaking it. Call-site
// discipline is a nice-to-have; the mechanism is the guarantee.
//
// Runtime facts established by probing supabase-edge-runtime 1.74.1 (Deno 2.1.4)
// on 2026-08-12 — see the plan's "Blocker resolution" section:
//   * `Deno.telemetry` is undefined: the runtime exposes none of Deno 2's
//     built-in OTel, so there is no auto-instrumentation to disable. Everything
//     here is explicit.
//   * The npm OTel packages DO work, but only at exact version pins. Bare
//     majors (`@opentelemetry/api@1`) fail to resolve, and `semantic-conventions`
//     and `core` fail even pinned — hence attribute keys as string literals
//     rather than imported semconv constants.
//   * `forceFlush()` resolves even when nothing was delivered; the exporter
//     swallows transport errors. Never read success from its return value.

const ENDPOINT = Deno.env.get('OTEL_EXPORTER_OTLP_ENDPOINT')?.replace(/\/+$/, '')
const HEADERS_RAW = Deno.env.get('OTEL_EXPORTER_OTLP_HEADERS')
const ENVIRONMENT = Deno.env.get('OTEL_ENVIRONMENT') ?? 'unknown'
// Stamped at deploy time so a span can be traced back to the exact commit.
// Omitted entirely when absent — never emitted as an empty value.
const REVISION = Deno.env.get('OTEL_VCS_REVISION')
const REPO_URL = 'https://github.com/OrCoAI/lev-yam-main'

/** Telemetry is off unless BOTH the endpoint and the auth header are configured.
 *  Off means genuinely inert: the npm packages are never even imported, so a
 *  function with no telemetry secrets behaves exactly as it did before H8
 *  (architecture invariant 7 — additive only). */
const telemetryEnabled = Boolean(ENDPOINT && HEADERS_RAW)

/** The complete set of things that may ever reach a span. See the header.
 *  Every string value is gated by `sanitize()` before export — these types
 *  describe intent, the regex is what actually enforces it. */
export type Facts = {
  /** Low-cardinality operation name, e.g. 'delete', 'login/verify'. */
  action?: string
  /** Which sub-step of a multi-step action failed, e.g. 'assign_role'. Only
   *  meaningful where one action has several places it can break — it exists so
   *  `error_class` keeps meaning "the class of a thrown error" instead of being
   *  a dumping ground for hand-invented operation names. */
  step?: string
  /** Permission key re-checked server-side, e.g. 'users.delete'. Already known
   *  to the caller, so recording it costs no extra query. */
  permission?: string
  /** How the call ended. 'denied' is an expected authorization refusal, not a
   *  fault. Usually DERIVED from the response status — set it explicitly only
   *  where status and meaning genuinely differ (a 200 whose audit write failed). */
  outcome?: 'ok' | 'denied' | 'error'
  /** Constructor name of a thrown error — a code identifier, never message text. */
  error_class?: string
  /** Short machine code (e.g. a Postgres SQLSTATE, a GoTrue error code). Typed
   *  `unknown` on purpose: it comes straight off third-party error objects, and
   *  `sanitize()` — not the caller — decides whether it is safe to export. */
  error_code?: unknown
}

/** The charset gate for every exported string value.
 *
 *  Deliberately excludes `@`, whitespace and quotes, so an email address, a
 *  sentence, or an error message cannot pass as a "code" no matter which field
 *  it arrives in. `/` and `.` are allowed because real values need them
 *  ('login/options', 'users.manage'); the 60-char cap bounds cardinality.
 *  Non-strings are dropped outright rather than stringified — `String(err)` is
 *  exactly how a message would sneak in. */
const SAFE_VALUE = /^[A-Za-z0-9_./:-]{1,60}$/
const sanitize = (v: unknown): string | undefined =>
  typeof v === 'string' && SAFE_VALUE.test(v) ? v : undefined

/** `outcome` is a closed set, so it is checked against the set rather than the
 *  charset — the TypeScript union alone is a compile-time promise, and this file
 *  argues everywhere else that compile-time promises are not enforcement. */
const OUTCOMES = new Set(['ok', 'denied', 'error'])

/** Upper bound on the awaited OTLP flush; see `flush` for why it exists. */
const FLUSH_DEADLINE_MS = 2000

/** A closed set, so `http.request.method` has bounded cardinality no matter what
 *  a caller sends. `sanitize()` is NOT sufficient here — it accepts any token up
 *  to 60 chars, so `FOO1`, `FOO2`, … would each become a distinct attribute
 *  value. Every function currently gates on POST before tracing, but this must
 *  hold for the next one that forgets. */
const HTTP_METHODS = new Set([
  'GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'CONNECT', 'TRACE',
])

/** OTLP's `key=value,key2=value2` header encoding. Split on the FIRST `=` only:
 *  the Dynatrace value is `Api-Token dt0c01…`, which contains a space and may
 *  contain `=` padding. */
function parseHeaders(raw: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const pair of raw.split(',')) {
    const eq = pair.indexOf('=')
    if (eq < 1) continue
    out[pair.slice(0, eq).trim()] = pair.slice(eq + 1).trim()
  }
  return out
}

/** Facts derivable from a caught error WITHOUT touching its message.
 *  Both values still pass through `sanitize()` on export.
 *
 *  `error_code` is omitted rather than set to `undefined` when the error has no
 *  code: these facts get Object.assign'd over whatever a handler already
 *  reported, and an explicit `undefined` would erase a code it had set. */
export const errorFacts = (e: unknown): Facts => {
  const code = (e as { code?: unknown })?.code
  return {
    outcome: 'error',
    error_class: (e as { constructor?: { name?: string } })?.constructor?.name ?? typeof e,
    // `== null` catches null as well as undefined: an explicit null would also
    // overwrite a code the handler had already reported.
    ...(code == null ? {} : { error_code: code }),
  }
}

type Providers = {
  tracer: { startSpan: (name: string) => Span }
  logger: { emit: (r: Record<string, unknown>) => void }
  /** Builds the OTel Context that links a log record to its span. The logs SDK
   *  wants a full Context here, NOT a bare SpanContext — passing the latter
   *  throws inside emit(), which (found 2026-08-12) silently cost every log
   *  record: the throw aborted the flush before the log exporter ever ran, while
   *  the span had already shipped on end(). */
  contextFor: (span: Span) => unknown
  /** SpanStatusCode.ERROR, read from the SDK rather than hardcoded as 2. */
  errorStatus: number
  flush: () => Promise<void>
}
type Span = {
  setAttribute: (k: string, v: string | number | boolean) => void
  setStatus: (s: { code: number; message?: string }) => void
  updateName: (n: string) => void
  end: () => void
  /** Handed straight to trace.setSpanContext; this file never reads the fields. */
  spanContext: () => unknown
}

// Built once on first use and cached. Keyed by fnName rather than a single
// module-level slot: in production each function is its own isolate, but
// `supabase functions serve` runs several locally, and a shared slot would let
// whichever function warmed up first name every other function's spans.
const providerCache = new Map<string, Promise<Providers | null>>()

function getProviders(fnName: string): Promise<Providers | null> {
  if (!telemetryEnabled) return Promise.resolve(null)
  const cached = providerCache.get(fnName)
  if (cached) return cached
  const built = (async () => {
    try {
      // Deferred so a function with no telemetry secrets never pays to load them,
      // and loaded CONCURRENTLY — six serial awaits made the whole module graph
      // the cold-start critical path for the first request into an isolate.
      //
      // The specifiers MUST be inline string literals with EXACT versions. The
      // edge runtime resolves `npm:` deps by static analysis, so a specifier
      // held in a `const` is invisible to it and fails at run time with
      // `Could not find constraint '<pkg>' in the list of packages` — which is
      // exactly how this first failed (2026-08-12). Bare majors fail the same
      // way. Keeping them inline inside Promise.all preserves that; do not hoist
      // them into constants or a loop.
      const [
        { context: otelContext, trace, SpanStatusCode },
        { resourceFromAttributes },
        { BasicTracerProvider, SimpleSpanProcessor },
        { OTLPTraceExporter },
        { LoggerProvider, SimpleLogRecordProcessor },
        { OTLPLogExporter },
      ] = await Promise.all([
        import('npm:@opentelemetry/api@1.9.0'),
        import('npm:@opentelemetry/resources@2.1.0'),
        import('npm:@opentelemetry/sdk-trace-base@2.1.0'),
        import('npm:@opentelemetry/exporter-trace-otlp-proto@0.207.0'),
        import('npm:@opentelemetry/sdk-logs@0.207.0'),
        import('npm:@opentelemetry/exporter-logs-otlp-proto@0.207.0'),
      ])

      const headers = parseHeaders(HEADERS_RAW!)
      const resource = resourceFromAttributes({
        // Each function is deployed and fails independently, so each gets its own
        // service identity; the shared namespace keeps them grouped in Bluebox.
        // Set in code rather than via OTEL_SERVICE_NAME because Supabase secrets
        // are project-wide — one env var cannot name three services.
        'service.name': `levyam-edge-${fnName}`,
        'service.namespace': 'levyam-platform',
        'deployment.environment': ENVIRONMENT,
        'vcs.repository.url.full': REPO_URL,
        ...(REVISION ? { 'vcs.ref.head.revision': REVISION } : {}),
      })

      // SimpleSpanProcessor, not Batch: an edge isolate can be frozen or
      // discarded between requests, so a batch queue is a queue of spans that
      // never ship.
      const traceProvider = new BasicTracerProvider({
        resource,
        spanProcessors: [new SimpleSpanProcessor(
          new OTLPTraceExporter({ url: `${ENDPOINT}/v1/traces`, headers }),
        )],
      })
      const loggerProvider = new LoggerProvider({
        resource,
        processors: [new SimpleLogRecordProcessor(
          new OTLPLogExporter({ url: `${ENDPOINT}/v1/logs`, headers }),
        )],
      })

      return {
        tracer: traceProvider.getTracer('levyam-edge'),
        logger: loggerProvider.getLogger('levyam-edge'),
        contextFor: (span: Span) => trace.setSpanContext(otelContext.active(), span.spanContext()),
        errorStatus: SpanStatusCode.ERROR,
        // Concurrent: two independent providers hitting two independent
        // endpoints. Serial awaits doubled the tail latency of the very path
        // this file deliberately puts on the request's critical path, and worst
        // on the error path where both actually carry a payload. allSettled, not
        // all, so a rejection from the slower one can't escape as an unhandled
        // rejection after the first has already settled. The thunks matter too:
        // a SYNCHRONOUS throw from the first forceFlush would otherwise be
        // raised while building the array, so the second never runs at all.
        //
        // The deadline is the important part. This flush is awaited on the
        // request path, and the exporter's own bound is a 10s timeout PLUS retry
        // backoff — so a blackholed ingest endpoint (DNS resolves, TCP connects,
        // nothing comes back) would add ~10s to every privileged action after
        // the work was already done, which is the one way telemetry becomes
        // user-visible. Losing a span beats stalling an owner mid-operation.
        flush: async () => {
          let timer: number | undefined
          try {
            await Promise.race([
              Promise.allSettled([
                Promise.resolve().then(() => traceProvider.forceFlush()),
                Promise.resolve().then(() => loggerProvider.forceFlush()),
              ]),
              new Promise<void>((resolve) => { timer = setTimeout(resolve, FLUSH_DEADLINE_MS) }),
            ])
          } finally {
            // Don't leave a pending timer holding the isolate open.
            if (timer !== undefined) clearTimeout(timer)
          }
        },
      }
    } catch (e) {
      // Telemetry must never be the reason a user-facing call fails. A broken
      // exporter degrades to "no telemetry", never to a 500.
      //
      // But it must not degrade SILENTLY: with the secrets set, "no spans in
      // Bluebox" is otherwise indistinguishable from "no traffic", and there is
      // nowhere to look. This one line goes to Supabase's own function logs
      // (not to Bluebox — the exporter is what just failed) and is our own
      // initialization error, carrying no request data.
      console.error('[otel] provider init failed; telemetry disabled for this isolate:', e)
      return null
    }
  })()
  providerCache.set(fnName, built)
  return built
}

/**
 * Wrap an Edge Function handler in one span.
 *
 * The handler receives `report`, the ONLY channel onto the span — it accepts the
 * `Facts` shape and nothing else, and every value it carries is sanitized here
 * before export. That is what makes the allow-list structural rather than a rule
 * each call site has to remember.
 *
 * `outcome` is DERIVED from the response status (2xx ok / 4xx denied / 5xx
 * error) unless the handler reported one explicitly. Call sites therefore cannot
 * forget it, and an explicit `report({outcome})` remains available for the cases
 * where status and meaning differ — admin-user-ops reports `error` on a 200 when
 * only the audit write failed.
 *
 * Behaviour is unchanged in every case: the handler's Response (or thrown value)
 * is returned/rethrown untouched, and any telemetry failure is swallowed.
 */
export async function traced(
  fnName: string,
  req: Request,
  handler: (report: (f: Facts) => void) => Promise<Response>,
): Promise<Response> {
  const facts: Facts = {}
  const report = (f: Facts) => Object.assign(facts, f)

  const providers = await getProviders(fnName)
  if (!providers) return handler(report)

  // Guarded like everything else: this was the one telemetry call left outside a
  // try, so a throw here (a bad sampler after an SDK bump, a shut-down provider)
  // escaped traced() entirely — the handler never ran and the runtime returned a
  // bare 500 with no CORS headers and no JSON body, which is exactly the "never
  // let telemetry break the request" rule this file claims to follow. Falls back
  // to running the handler untraced.
  let span: Span
  try {
    span = providers.tracer.startSpan(fnName)
  } catch (e) {
    console.error('[otel] span creation failed; running untraced:', e)
    return handler(report)
  }
  const started = Date.now()
  let status: number | undefined
  try {
    const res = await handler(report)
    status = res.status
    return res
  } catch (e) {
    // Insurance, not live code for today's callers: all three handlers catch
    // their own throws and convert them to a Response, so nothing reaches here.
    // It stays so a future handler that does let something escape is still
    // recorded rather than silently untraced. A thrown Response is control flow
    // (http.requireUser's 401), not a fault.
    if (e instanceof Response) status = e.status
    else Object.assign(facts, errorFacts(e))
    throw e
  } finally {
    // Awaited, NOT deferred. `EdgeRuntime.waitUntil` exists on edge-runtime
    // 1.74.1, and the obvious design is to flush after the response is on the
    // wire — but measured on 2026-08-12 it does not reliably hold the isolate
    // open: the span survived only because SimpleSpanProcessor exports
    // synchronously inside span.end(), while the log record emitted a few lines
    // later was silently dropped every time. Awaiting costs one OTLP round trip
    // per request; these are low-volume internal admin/auth calls, and telemetry
    // that silently loses half its signal is worth less than the latency saved.
    // If this ever moves onto a hot path, the fix is a real queue/collector, not
    // waitUntil.
    try {
      // Sanitize once, up front: everything below reads only from `safe`, so no
      // path can put an unvetted value on the span — including the span NAME,
      // which would otherwise be both a leak and unbounded cardinality.
      const safe: Record<string, string> = {}
      for (const key of ['action', 'step', 'permission', 'error_class', 'error_code'] as const) {
        const v = sanitize(facts[key])
        if (v !== undefined) safe[key] = v
      }
      // Derived unless the handler overrode it; see the doc comment above.
      const outcome = facts.outcome ??
        (status === undefined ? undefined : status < 400 ? 'ok' : status < 500 ? 'denied' : 'error')

      // span.end() sits in its own finally: if any attribute write throws, the
      // span must STILL be ended and exported. Otherwise the outer catch would
      // swallow the throw, skip end(), and the request would vanish from Bluebox
      // entirely — silently, and precisely on the error requests this exists to
      // surface. Attribute failures are logged rather than swallowed, for the
      // same reason.
      try {
        if (safe.action) span.updateName(`${fnName} ${safe.action}`)
        span.setAttribute('code.function', fnName)
        // Closed set, not sanitize(): see HTTP_METHODS. All three functions gate
        // on POST before tracing, so this normally only ever sees POST.
        span.setAttribute('http.request.method', HTTP_METHODS.has(req.method) ? req.method : 'OTHER')
        if (status !== undefined) span.setAttribute('http.response.status_code', status)
        for (const [key, v] of Object.entries(safe)) span.setAttribute(`levyam.${key}`, v)
        // Checked against the closed set, not just the TypeScript union.
        if (outcome && OUTCOMES.has(outcome)) span.setAttribute('levyam.outcome', outcome)
        // No `message` — that field is free text.
        if (outcome === 'error') span.setStatus({ code: providers.errorStatus })
      } catch (e) {
        console.error('[otel] span attribute write failed:', e)
      } finally {
        // end() is where SimpleSpanProcessor exports synchronously, so it is the
        // one call here that can realistically throw. Guarded too: otherwise a
        // failing export would skip the log record and the flush below, which is
        // the very "an error request vanishes silently" case this block exists
        // to prevent.
        try { span.end() } catch (e) { console.error('[otel] span end failed:', e) }
      }

      // Sanitized log export (owner's chosen level). The existing console.error
      // calls are left exactly as they are — those go to Supabase's own function
      // logs and are untouched by this file. What ships to Bluebox is class and
      // code only, correlated to the span.
      if (outcome === 'error') {
        // Its own try/catch: a log record that cannot be built must not take the
        // span's flush down with it (that is exactly what happened when this
        // passed the wrong context type).
        try {
          providers.logger.emit({
            severityNumber: 17,
            severityText: 'ERROR',
            // A fixed, generated string built only from sanitized values — never
            // the error's own message, which is where an invitee's email address
            // would ride along.
            body: `${fnName}${safe.action ? ` ${safe.action}` : ''}${safe.step ? `/${safe.step}` : ''} failed`,
            attributes: {
              'code.function': fnName,
              // A thrown error contributes a class; a reported sub-step failure
              // contributes only a step, so fall back to it rather than logging
              // a useless 'unknown'.
              'error.type': safe.error_class ?? safe.step ?? 'unknown',
              ...(safe.error_code ? { 'error.code': safe.error_code } : {}),
              ...(safe.step ? { 'levyam.step': safe.step } : {}),
              'duration.ms': Date.now() - started,
            },
            context: providers.contextFor(span),
          })
        } catch (e) {
          // Same reasoning as the init failure above: keep going (the span still
          // matters), but never go dark without saying why.
          console.error('[otel] log record emit failed:', e)
        }
      }
      await providers.flush()
    } catch { /* telemetry is best-effort, always */ }
  }
}
