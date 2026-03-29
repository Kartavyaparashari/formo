import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../contexts/AuthContext';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Loader from '../../components/ui/Loader';

const S = {
  card: {
    background: 'var(--surface)', backdropFilter: 'blur(20px)',
    border: '1px solid var(--border)', borderRadius: 14,
    padding: 24, marginBottom: 20,
  },
  th: { padding: '12px 16px', textAlign: 'left', fontSize: 10, fontWeight: 700, letterSpacing: 2, color: 'var(--text-muted)', textTransform: 'uppercase', borderBottom: '1px solid var(--border)' },
  td: { padding: '12px 16px', fontSize: 13, color: 'var(--text-mid)', borderBottom: '1px solid var(--border)' },
  label: { fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 6 },
};

export default function ExclusionItems() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [companyId, setCompanyId] = useState(null);

  const [form, setForm] = useState({
    from_height: '',
    to_height: '',
    item_prefix: '',
    from_width: '',
    to_width: '',
    status: 'active'
  });

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    
    const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', user.id).single();
    if (profile?.company_id) {
      setCompanyId(profile.company_id);
      const { data } = await supabase
        .from('exclusion_items')
        .select('*')
        .eq('company_id', profile.company_id)
        .order('created_at', { ascending: false });
      setItems(data || []);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!companyId) return;
    setSaving(true); setError(null);
    
    const { error } = await supabase.from('exclusion_items').insert([{ 
      ...form, 
      company_id: companyId,
      from_height: form.from_height ? parseFloat(form.from_height) : null,
      to_height: form.to_height ? parseFloat(form.to_height) : null,
      from_width: form.from_width ? parseFloat(form.from_width) : null,
      to_width: form.to_width ? parseFloat(form.to_width) : null
    }]);

    if (error) {
      setError(error.message);
    } else {
      setAdding(false);
      setForm({ from_height: '', to_height: '', item_prefix: '', from_width: '', to_width: '', status: 'active' });
      loadData();
    }
    setSaving(false);
  };

  const deleteItem = async (id) => {
    if (!window.confirm('Delete this exclusion item?')) return;
    await supabase.from('exclusion_items').delete().eq('id', id);
    loadData();
  };

  if (loading) return <div style={{ display:'flex', justifyContent:'center', padding:50 }}><Loader /></div>;

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 20, color: 'var(--text)' }}>Exclusion Items Settings</h2>
        <Button onClick={() => setAdding(!adding)} variant={adding ? "secondary" : "primary"}>
          {adding ? "Cancel" : "+ Add Exclusion"}
        </Button>
      </div>

      <AnimatePresence>
        {adding && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} style={{ overflow: 'hidden' }}>
            <div style={S.card}>
              <form onSubmit={handleAdd} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                <div>
                  <label style={S.label}>Item Prefix</label>
                  <Input required placeholder="e.g. SL, PNL" value={form.item_prefix} onChange={e => setForm({...form, item_prefix: e.target.value})} />
                </div>
                <div>
                  <label style={S.label}>From Height</label>
                  <Input type="number" placeholder="0" value={form.from_height} onChange={e => setForm({...form, from_height: e.target.value})} />
                </div>
                <div>
                  <label style={S.label}>To Height</label>
                  <Input type="number" placeholder="2400" value={form.to_height} onChange={e => setForm({...form, to_height: e.target.value})} />
                </div>
                <div>
                  <label style={S.label}>From Width</label>
                  <Input type="number" placeholder="0" value={form.from_width} onChange={e => setForm({...form, from_width: e.target.value})} />
                </div>
                <div>
                  <label style={S.label}>To Width</label>
                  <Input type="number" placeholder="600" value={form.to_width} onChange={e => setForm({...form, to_width: e.target.value})} />
                </div>
                <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
                  <Button type="submit" disabled={saving}>
                    {saving ? "Saving..." : "Save Exclusion Rule"}
                  </Button>
                </div>
              </form>
              {error && <p style={{ color: 'var(--danger)', fontSize: 12, marginTop: 10 }}>{error}</p>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div style={S.card}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={S.th}>Prefix</th>
                <th style={S.th}>Height Range</th>
                <th style={S.th}>Width Range</th>
                <th style={S.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan={4} style={{ ...S.td, textAlign:'center', color:'var(--text-muted)' }}>No exclusions defined.</td></tr>
              ) : (
                items.map(item => (
                  <motion.tr key={item.id} layout>
                    <td style={S.td}>{item.item_prefix}</td>
                    <td style={S.td}>{item.from_height || 0} - {item.to_height || '∞'}</td>
                    <td style={S.td}>{item.from_width || 0} - {item.to_width || '∞'}</td>
                    <td style={S.td}>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <Button onClick={() => deleteItem(item.id)} variant="danger" style={{ padding: '4px 8px', fontSize: 10 }}>
                          Delete
                        </Button>
                      </div>
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
