import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../contexts/AuthContext';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
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

export default function SortMasterSettings() {
  const { user, profile } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [editingId, setEditingId] = useState(null);

  const emptyForm = { type: '', plan_prifix: '', item_prefix: '', priority: '', from_height: '', to_height: '', from_width: '', to_width: '', for_plan: 'pnl', status: 'active' };
  const [form, setForm] = useState({ ...emptyForm });

  const loadData = useCallback(async () => {
    if (!user || !profile?.company_id) return;
    setLoading(true);
    
    const { data } = await supabase
      .from('sort_master')
      .select('*')
      .eq('company_id', profile.company_id)
      .order('created_at', { ascending: false });
    setItems(data || []);
    setLoading(false);
  }, [user, profile]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!profile?.company_id) return;
    setSaving(true); setError(null);

    const payload = {
      ...form,
      company_id: profile.company_id,
      from_height: form.from_height ? parseFloat(form.from_height) : null,
      to_height: form.to_height ? parseFloat(form.to_height) : null,
      from_width: form.from_width ? parseFloat(form.from_width) : null,
      to_width: form.to_width ? parseFloat(form.to_width) : null,
      priority: form.priority ? parseInt(form.priority) : null
    };

    let result;
    if (editingId) {
      result = await supabase.from('sort_master').update(payload).eq('id', editingId);
    } else {
      result = await supabase.from('sort_master').insert([payload]);
    }

    if (result.error) {
      setError(result.error.message);
    } else {
      setAdding(false);
      setEditingId(null);
      setForm({ ...emptyForm });
      loadData();
    }
    setSaving(false);
  };

  const startEdit = (item) => {
    setForm({
      type: item.type || '',
      plan_prifix: item.plan_prifix || '',
      item_prefix: item.item_prefix || '',
      priority: item.priority ?? '',
      from_height: item.from_height ?? '',
      to_height: item.to_height ?? '',
      from_width: item.from_width ?? '',
      to_width: item.to_width ?? '',
      for_plan: item.for_plan || 'pnl',
      status: item.status || 'active'
    });
    setEditingId(item.id);
    setAdding(true);
  };

  const toggleStatus = async (id, currentStatus) => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    await supabase.from('sort_master').update({ status: newStatus }).eq('id', id);
    loadData();
  };

  const deleteItem = async (id) => {
    if (!window.confirm('Delete this sort rule?')) return;
    await supabase.from('sort_master').delete().eq('id', id);
    loadData();
  };

  if (loading) return <div style={{ display:'flex', justifyContent:'center', padding:50 }}><Loader /></div>;

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 20, color: 'var(--text)' }}>Sort Master Settings</h2>
        <Button onClick={() => { setAdding(!adding); if (adding) { setEditingId(null); setForm({...emptyForm}); } }} variant={adding ? "secondary" : "primary"}>
          {adding ? "Cancel" : "+ Add Sort Rule"}
        </Button>
      </div>

      <AnimatePresence>
        {adding && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} style={{ overflow: 'hidden' }}>
            <div style={S.card}>
              <form onSubmit={handleAdd} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                <div>
                  <label style={S.label}>Sort Type</label>
                  <Input required placeholder="e.g. Height Wise" value={form.type} onChange={e => setForm({...form, type: e.target.value})} />
                </div>
                <div>
                  <label style={S.label}>Plan Prefix</label>
                  <Input placeholder="e.g. SL" value={form.plan_prifix} onChange={e => setForm({...form, plan_prifix: e.target.value})} />
                </div>
                <div>
                  <label style={S.label}>For Plan</label>
                  <Select value={form.for_plan} onChange={e => setForm({...form, for_plan: e.target.value})}>
                    <option value="pnl">PNL (Panel)</option>
                    <option value="sec">SEC (Secondary)</option>
                    <option value="spl">SPL (Special)</option>
                    <option value="other">Other</option>
                  </Select>
                </div>
                <div>
                  <label style={S.label}>Item Prefix</label>
                  <Input placeholder="e.g. PNL" value={form.item_prefix} onChange={e => setForm({...form, item_prefix: e.target.value})} />
                </div>
                <div>
                  <label style={S.label}>Priority</label>
                  <Input type="number" placeholder="e.g. 1" value={form.priority} onChange={e => setForm({...form, priority: e.target.value})} />
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
                    {saving ? "Saving..." : editingId ? "Update Sort Rule" : "Save Sort Rule"}
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
                <th style={S.th}>Type</th>
                <th style={S.th}>Prefix</th>
                <th style={S.th}>Item Prefix</th>
                <th style={S.th}>For Plan</th>
                <th style={S.th}>Priority</th>
                <th style={S.th}>Height Range</th>
                <th style={S.th}>Width Range</th>
                <th style={S.th}>Status</th>
                <th style={S.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan={9} style={{ ...S.td, textAlign:'center', color:'var(--text-muted)' }}>No sort rules defined yet.</td></tr>
              ) : (
                items.map(item => (
                  <motion.tr key={item.id} layout>
                    <td style={S.td}>{item.type}</td>
                    <td style={S.td}>{item.plan_prifix}</td>
                    <td style={S.td}>{item.item_prefix || '—'}</td>
                    <td style={S.td}><span style={{ textTransform: 'uppercase', fontSize: 11, fontWeight: 600 }}>{item.for_plan}</span></td>
                    <td style={S.td}>{item.priority ?? '—'}</td>
                    <td style={S.td}>{item.from_height || 0} - {item.to_height || '∞'}</td>
                    <td style={S.td}>{item.from_width || 0} - {item.to_width || '∞'}</td>
                    <td style={S.td}>
                      <span style={{ 
                        padding: '4px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                        background: item.status === 'active' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                        color: item.status === 'active' ? '#22c55e' : '#ef4444'
                      }}>
                        {item.status}
                      </span>
                    </td>
                    <td style={S.td}>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button
                          onClick={() => toggleStatus(item.id, item.status)}
                          style={{
                            padding: '4px 12px', borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: 'pointer',
                            border: 'none',
                            background: item.status === 'active' ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)',
                            color: item.status === 'active' ? '#ef4444' : '#22c55e'
                          }}
                        >
                          {item.status === 'active' ? 'Deactivate' : 'Activate'}
                        </button>
                        <Button onClick={() => startEdit(item)} variant="outline" style={{ padding: '4px 10px', fontSize: 10 }}>
                          Edit
                        </Button>
                        <Button onClick={() => deleteItem(item.id)} variant="danger" style={{ padding: '4px 10px', fontSize: 10 }}>
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
