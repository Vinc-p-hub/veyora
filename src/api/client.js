// Data access layer on top of Supabase (PostgREST + Realtime + Edge Functions + Storage).
// Exposes a small, entity-oriented API: api.entities.Product.list/filter/get/create/update/delete/subscribe.
import { supabase } from '@/lib/supabase';

// Entity name -> Postgres table (see supabase/migrations). `User` lives in `profiles`.
const TABLES = {
  AuditLog: 'audit_logs', CountryConfig: 'country_configs', CrawlerJob: 'crawler_jobs',
  CrawlerSource: 'crawler_sources', CurrencyRate: 'currency_rates', Dispute: 'disputes',
  GithubProject: 'github_projects', GithubPullRequest: 'github_pull_requests',
  HeroSlide: 'hero_slides', Offer: 'offers', Order: 'orders', PaymentIntent: 'payment_intents',
  PricingChangeLog: 'pricing_change_logs', PricingConfig: 'pricing_configs', Product: 'products',
  Promotion: 'promotions', PspCredential: 'psp_credentials', PspWebhookEvent: 'psp_webhook_events',
  Refund: 'refunds', Review: 'reviews', ReviewInvitation: 'review_invitations',
  SearchQuery: 'search_queries', Seller: 'sellers', SiteSetting: 'site_settings',
  SourceReview: 'source_reviews', StockMovement: 'stock_movements', SupportTicket: 'support_tickets',
  WishlistItem: 'wishlist_items', User: 'profiles',
};

const unwrap = ({ data, error }) => {
  if (error) {
    const err = new Error(error.message || 'Request failed');
    err.status = error.status || (error.code === 'PGRST116' ? 404 : 400);
    err.code = error.code;
    throw err;
  }
  return data;
};

function applySort(q, sort) {
  if (!sort) return q;
  const desc = sort.startsWith('-');
  return q.order(desc ? sort.slice(1) : sort, { ascending: !desc });
}

function applyFilters(q, query = {}) {
  for (const [key, value] of Object.entries(query)) {
    if (Array.isArray(value)) q = q.in(key, value);
    else if (value === null) q = q.is(key, null);
    else q = q.eq(key, value);
  }
  return q;
}

const newId = () => (globalThis.crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);

function entity(name) {
  const table = TABLES[name];
  const from = () => supabase.from(table);

  const select = async (query, sort, limit) => {
    let q = applyFilters(from().select('*'), query);
    q = applySort(q, sort);
    if (limit) q = q.limit(limit);
    return unwrap(await q) || [];
  };

  return {
    list: (sort, limit) => select({}, sort, limit),
    filter: (query, sort, limit) => select(query, sort, limit),

    async get(id) {
      const row = unwrap(await from().select('*').eq('id', id).maybeSingle());
      if (!row) {
        const err = new Error(`${name} not found`);
        err.status = 404;
        throw err;
      }
      return row;
    },

    // Guests (anon) may insert but not read back (RLS): return the payload with its id instead.
    async create(data) {
      const record = { id: newId(), ...data };
      const { data: session } = await supabase.auth.getSession();
      if (session?.session && name !== 'Order') {
        return unwrap(await from().insert(record).select().single());
      }
      unwrap(await from().insert(record));
      return record;
    },

    async update(id, data) {
      const row = unwrap(await from().update(data).eq('id', id).select().maybeSingle());
      if (!row) {
        const err = new Error(`${name} ${id} not found or not permitted`);
        err.status = 403;
        throw err;
      }
      return row;
    },

    // items: [{ id, ...fields }] or [{ id, data: {...fields} }]
    async bulkUpdate(items = []) {
      return Promise.all(items.map(({ id, data, ...rest }) => this.update(id, data || rest)));
    },

    async delete(id) {
      unwrap(await from().delete().eq('id', id));
      return { id };
    },

    // Realtime (respects RLS). Returns an unsubscribe function.
    subscribe(callback) {
      const channel = supabase
        .channel(`${table}-${newId()}`)
        .on('postgres_changes', { event: '*', schema: 'public', table }, (payload) => {
          callback({
            type: payload.eventType,
            id: (payload.new && payload.new.id) || (payload.old && payload.old.id),
            data: payload.new,
          });
        })
        .subscribe();
      return () => supabase.removeChannel(channel);
    },
  };
}

const entities = new Proxy({}, {
  get(target, name) {
    if (typeof name !== 'string' || !TABLES[name]) return undefined;
    return (target[name] ||= entity(name));
  },
});

// Some logical functions are actions of one Edge Function (shared code is deployed once).
const ROUTES = {
  crawlerRunSource: ['crawler', 'run_source'], crawlerProcessQueue: ['crawler', 'process_queue'],
  crawlerOrchestrate: ['crawler', 'orchestrate'], catalogNormalize: ['crawler', 'normalize'],
  sourceAutodetect: ['crawler', 'autodetect'], productImageFill: ['crawler', 'image_fill'],
  reviewSubmit: ['reviews', 'submit'], reviewReport: ['reviews', 'report'],
  reviewModerate: ['reviews', 'moderate'], reviewInvite: ['reviews', 'invite'],
  reviewImport: ['reviews', 'import'],
  ensureStaffRoles: ['staff', 'ensure_roles'], inviteUser: ['staff', 'invite'],
};

// Edge Functions: resolves to { data } like an HTTP client; rejects on error.
const functions = {
  async invoke(logicalName, payload = {}) {
    const [name, action] = ROUTES[logicalName] || [logicalName, null];
    const body = action ? { action, ...payload } : payload;
    const { data, error } = await supabase.functions.invoke(name, { body });
    if (error) {
      let detail = null;
      try { detail = await error.context?.json?.(); } catch { /* not JSON */ }
      const err = new Error(detail?.error || error.message || `Function ${name} failed`);
      err.status = error.context?.status;
      err.data = detail;
      throw err;
    }
    return { data };
  },
};

// Storage: public bucket, per-user folder.
const BUCKET = 'public-uploads';
const IMPORT_BUCKET = 'admin-imports';
const integrations = {
  Core: {
    // Back-office data files (CSV / XLSX / JSON): private bucket, admins only, any file type.
    // Returns a short-lived signed URL that the Edge Function downloads.
    async UploadPrivateFile({ file }) {
      const { data: session } = await supabase.auth.getSession();
      const uid = session?.session?.user?.id;
      if (!uid) throw new Error('Sign in to upload files');
      const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin';
      const path = `${uid}/${newId()}.${ext}`;
      unwrap(await supabase.storage.from(IMPORT_BUCKET).upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: false }));
      const { data, error } = await supabase.storage.from(IMPORT_BUCKET).createSignedUrl(path, 600);
      if (error) throw new Error(error.message);
      return { file_url: data.signedUrl };
    },
    async UploadPublicFile({ file }) {
      const { data: session } = await supabase.auth.getSession();
      const uid = session?.session?.user?.id;
      if (!uid) throw new Error('Sign in to upload files');
      const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '');
      const path = `${uid}/${newId()}.${ext}`;
      unwrap(await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false }));
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
      return { file_url: data.publicUrl };
    },
  },
};

export const api = { entities, functions, integrations };
