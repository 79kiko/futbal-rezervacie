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

async function sbGet(table) {
  const url = SUPABASE_URL + '/rest/v1/' + table + '?select=*&order=created_at.asc';
  const r = await fetch(url, { headers: sbHeaders() });
  if (!r.ok) throw new Error('GET ' + table + ' failed: ' + r.status + ' ' + await r.text());
  return await r.json();
}

async function sbInsert(table, data) {
  const url = SUPABASE_URL + '/rest/v1/' + table;
  const r = await fetch(url, {
    method: 'POST',
    headers: sbHeaders(),
    body: JSON.stringify(data)
  });
  if (!r.ok) throw new Error('INSERT ' + table + ' failed: ' + r.status + ' ' + await r.text());
  return await r.json();
}

async function sbUpdate(table, id, data) {
  const url = SUPABASE_URL + '/rest/v1/' + table + '?id=eq.' + id;
  const r = await fetch(url, {
    method: 'PATCH',
    headers: sbHeaders(),
    body: JSON.stringify(data)
  });
  if (!r.ok) throw new Error('UPDATE ' + table + ' failed: ' + r.status + ' ' + await r.text());
  return await r.json();
}

async function sbDelete(table, id) {
  const url = SUPABASE_URL + '/rest/v1/' + table + '?id=eq.' + id;
  const r = await fetch(url, {
    method: 'DELETE',
    headers: sbHeaders()
  });
  if (!r.ok) throw new Error('DELETE ' + table + ' failed: ' + r.status + ' ' + await r.text());
  return [];
}

async function sbUpsertSetting(key, value) {
  const url = SUPABASE_URL + '/rest/v1/settings?on_conflict=key';
  const headers = { ...sbHeaders(), 'Prefer': 'resolution=merge-duplicates,return=representation' };
  const r = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ key, value })
  });
  if (!r.ok) throw new Error('UPSERT settings failed: ' + r.status + ' ' + await r.text());
  return await r.json();
}

module.exports = async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Check env vars
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res.status(500).json({
      ok: false,
      error: 'Chyba: SUPABASE_URL alebo SUPABASE_ANON_KEY nie su nastavene v Environment Variables na Vercel.'
    });
  }

  try {
    let table, action, data, id;

    if (req.method === 'GET') {
      table = req.query.table;
      action = req.query.action || 'select';
    } else {
      const body = req.body || {};
      table = body.table;
      action = body.action;
      data = body.data;
      id = body.id;
    }

    if (!table) {
      return res.status(400).json({ ok: false, error: 'Chyba: chyba parameter "table"' });
    }

    let result;

    if (action === 'select') {
      result = await sbGet(table);
    } else if (action === 'insert') {
      result = await sbInsert(table, data);
    } else if (action === 'update') {
      result = await sbUpdate(table, id, data);
    } else if (action === 'delete') {
      result = await sbDelete(table, id);
    } else if (action === 'upsert_setting') {
      result = await sbUpsertSetting(data.key, data.value);
    } else {
      return res.status(400).json({ ok: false, error: 'Neznama akcia: ' + action });
    }

    return res.status(200).json({ ok: true, data: result });

  } catch (err) {
    console.error('[api/data] Error:', err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
};
