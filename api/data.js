// api/data.js - Vercel serverless function
// Vola Supabase REST API priamo cez fetch - bez npm balickov

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

function sbHeaders() {
  return {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_KEY,
    'Authorization': 'Bearer ' + SUPABASE_KEY,
    'Prefer': 'return=representation'
  };
}

// Different tables have different sort columns
function orderClause(table) {
  if (table === 'teams')        return 'sort_order.asc,name.asc';
  if (table === 'reservations') return 'date.asc,t0.asc';
  if (table === 'settings')     return 'key.asc';
  return 'created_at.asc';   // users, pitches
}

async function sbGet(table) {
  const url = SUPABASE_URL + '/rest/v1/' + table
    + '?select=*&order=' + orderClause(table);
  const r = await fetch(url, { headers: sbHeaders() });
  const text = await r.text();
  if (!r.ok) throw new Error('GET ' + table + ' failed: ' + r.status + ' ' + text);
  return JSON.parse(text);
}

async function sbInsert(table, data) {
  const url = SUPABASE_URL + '/rest/v1/' + table;
  const r = await fetch(url, {
    method: 'POST',
    headers: sbHeaders(),
    body: JSON.stringify(data)
  });
  const text = await r.text();
  if (!r.ok) throw new Error('INSERT ' + table + ' failed: ' + r.status + ' ' + text);
  return text ? JSON.parse(text) : [];
}

async function sbUpdate(table, id, data) {
  const url = SUPABASE_URL + '/rest/v1/' + table + '?id=eq.' + id;
  const r = await fetch(url, {
    method: 'PATCH',
    headers: sbHeaders(),
    body: JSON.stringify(data)
  });
  const text = await r.text();
  if (!r.ok) throw new Error('UPDATE ' + table + ' failed: ' + r.status + ' ' + text);
  return text ? JSON.parse(text) : [];
}

async function sbDelete(table, id) {
  const url = SUPABASE_URL + '/rest/v1/' + table + '?id=eq.' + id;
  const r = await fetch(url, {
    method: 'DELETE',
    headers: { ...sbHeaders(), 'Prefer': 'return=minimal' }
  });
  if (!r.ok) {
    const text = await r.text();
    throw new Error('DELETE ' + table + ' failed: ' + r.status + ' ' + text);
  }
  return [];
}

async function sbUpsertSetting(key, value) {
  const url = SUPABASE_URL + '/rest/v1/settings?on_conflict=key';
  const headers = {
    ...sbHeaders(),
    'Prefer': 'resolution=merge-duplicates,return=representation'
  };
  const r = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ key, value })
  });
  const text = await r.text();
  if (!r.ok) throw new Error('UPSERT settings failed: ' + r.status + ' ' + text);
  return text ? JSON.parse(text) : [];
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res.status(500).json({
      ok: false,
      error: 'SUPABASE_URL alebo SUPABASE_ANON_KEY nie su nastavene v Environment Variables.'
    });
  }

  try {
    let table, action, data, id;

    if (req.method === 'GET') {
      table  = req.query.table;
      action = req.query.action || 'select';
    } else {
      const body = req.body || {};
      table  = body.table;
      action = body.action;
      data   = body.data;
      id     = body.id;
    }

    if (!table) return res.status(400).json({ ok: false, error: 'Chyba: chyba parameter table' });

    let result;
    if      (action === 'select')          result = await sbGet(table);
    else if (action === 'insert')          result = await sbInsert(table, data);
    else if (action === 'update')          result = await sbUpdate(table, id, data);
    else if (action === 'delete')          result = await sbDelete(table, id);
    else if (action === 'upsert_setting')  result = await sbUpsertSetting(data.key, data.value);
    else return res.status(400).json({ ok: false, error: 'Neznama akcia: ' + action });

    return res.status(200).json({ ok: true, data: result });

  } catch (err) {
    console.error('[api/data] Error:', err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
};
