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

export default function ChildParts() {
  const { user, profile } = useAuth();
  const [items, setItems] = useState([]);
  const [sortMasters, setSortMasters] = useState([]);
  const [rmStocks, setRmStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const [form, setForm] = useState({
    sort_id: '',
    rm_name: '',
    rm_company_id: '',
    from_height: '',
    to_height: '',
    item_prefix: '',
    from_width: '',
    to_width: '',
    shape: '',
    child_part_quantity: 1,
    for_plan: 'pnl'
  });

  const loadData = useCallback(async () => {
    if (!user || !profile?.company_id) return;
    setLoading(true);
    
    const [partsRes, sortRes, stockRes] = await Promise.all([
      supabase.from('child_parts').select('*, sort_master(type, plan_prifix)').eq('company_id', profile.company_id).order('created_at', { ascending: false }),
      supabase.from('sort_master').select('*').eq('company_id', profile.company_id).eq('status', 'active'),
      supabase.from('rm_stock').select('company_id, rm_name').eq('company_id', profile.company_id)
    ]);

    setItems(partsRes.data || []);
    setSortMasters(sortRes.data || []);
    setRmStocks(stockRes.data || []);
    setLoading(false);
  }, [user, profile]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleRmChange = (val) => {
    const stock = rmStocks.find(s => s.rm_name === val);
    setForm({ 
      ...form, 
      rm_name: val, 
      rm_company_id: stock ? stock.company_id : '' 
    });
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!profile?.company_id) return;
    setSaving(true); setError(null);
    
    const { error } = await supabase.from('child_parts').insert([{ 
      ...form, 
      company_id: profile.company_id,
      from_height: form.from_height ? parseFloat(form.from_height) : null,
      to_height: form.to_height ? parseFloat(form.to_height) : null,
      from_width: form.from_width ? parseFloat(form.from_width) : null,
      to_width: form.to_width ? parseFloat(form.to_width) : null,
      child_part_quantity: parseInt(form.child_part_quantity)
    }]);

    if (error) {
      setError(error.message);
    } else {
      setAdding(false);
      setForm({ sort_id: '', rm_name: '', rm_company_id: '', from_height: '', to_height: '', item_prefix: '', from_width: '', to_width: '', shape: '', child_part_quantity: 1, for_plan: 'pnl' });
      loadData();
    }
    setSaving(false);
  };

  const deleteItem = async (id) => {
    if (!window.confirm('Delete this child part?')) return;
    await supabase.from('child_parts').delete().eq('id', id);
    loadData();
  };

  if (loading) return <div style={{ display:'flex', justifyContent:'center', padding:50 }}><Loader /></div>;

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 20, color: 'var(--text)' }}>Child Parts Settings</h2>
        <Button onClick={() => setAdding(!adding)} variant={adding ? "secondary" : "primary"}>
          {adding ? "Cancel" : "+ Add Child Part"}
        </Button>
      </div>

      <AnimatePresence>
        {adding && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} style={{ overflow: 'hidden' }}>
            <div style={S.card}>
              <form onSubmit={handleAdd} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                <div>
                  <label style={S.label}>Parent Sort Rule</label>
                  <Select required value={form.sort_id} onChange={e => setForm({...form, sort_id: e.target.value})}>
                    <option value="">Select a Rule</option>
                    {sortMasters.map(s => (
                      <option key={s.id} value={s.id}>{s.type} ({s.plan_prifix})</option>
                    ))}
                  </Select>
                </div>
                <div>
                  <label style={S.label}>RM Stock</label>
                  <Select required value={form.rm_name} onChange={e => handleRmChange(e.target.value)}>
                    <option value="">Select Material</option>
                    {rmStocks.map(s => (
                      <option key={s.rm_name} value={s.rm_name}>{s.rm_name}</option>
                    ))}
                  </Select>
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
                <div>
                  <label style={S.label}>Quantity</label>
                  <Input required type="number" value={form.child_part_quantity} onChange={e => setForm({...form, child_part_quantity: e.target.value})} />
                </div>
                <div>
                  <label style={S.label}>Shape</label>
                  <Input placeholder="e.g. Angle" value={form.shape} onChange={e => setForm({...form, shape: e.target.value})} />
                </div>
                <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
                  <Button type="submit" disabled={saving}>
                    {saving ? "Saving..." : "Save Child Part"}
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
                <th style={S.th}>Parent Rule</th>
                <th style={S.th}>RM Name</th>
                <th style={S.th}>For Plan</th>
                <th style={S.th}>Prefix</th>
                <th style={S.th}>Height Range</th>
                <th style={S.th}>Qty</th>
                <th style={S.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan={7} style={{ ...S.td, textAlign:'center', color:'var(--text-muted)' }}>No child parts defined.</td></tr>
              ) : (
                items.map(item => (
                  <motion.tr key={item.id} layout>
                    <td style={S.td}>{item.sort_master?.type || '—'}</td>
                    <td style={S.td}>{item.rm_name}</td>
                    <td style={S.td}><span style={{ textTransform: 'uppercase', fontSize: 11, fontWeight: 600 }}>{item.for_plan}</span></td>
                    <td style={S.td}>{item.item_prefix}</td>
                    <td style={S.td}>{item.from_height || 0} - {item.to_height || '∞'}</td>
                    <td style={S.td}>{item.child_part_quantity}</td>
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
