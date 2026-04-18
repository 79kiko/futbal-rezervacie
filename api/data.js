const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { table, action, data, id } = req.method === 'GET'
    ? req.query
    : req.body;

  try {
    let result;
    if (action === 'select' || req.method === 'GET') {
      result = await supabase.from(table).select('*').order('created_at');
    } else if (action === 'insert') {
      result = await supabase.from(table).insert(data).select();
    } else if (action === 'update') {
      result = await supabase.from(table).update(data).eq('id', id).select();
    } else if (action === 'delete') {
      result = await supabase.from(table).delete().eq('id', id);
    } else if (action === 'upsert_setting') {
      result = await supabase.from('settings').upsert(data);
    }
    if (result.error) throw result.error;
    res.status(200).json({ ok: true, data: result.data });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
};
