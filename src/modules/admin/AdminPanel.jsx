import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../contexts/AuthContext';

/* ─── Module list (for page access control) ─────────────── */
const MODULES = [
  { key: 'import',       label: 'Import',            icon: '📥' },
  { key: 'plan',         label: 'Plan',              icon: '📋' },
  { key: 'material_ops', label: 'Material Operations', icon: '⚙️' },
  { key: 'reports',      label: 'Reports',           icon: '📊' },
  { key: 'ai_chatbot',   label: 'AI Chatbot',        icon: '🤖' },
  { key: 'scan',         label: 'Scan',              icon: '🔍' },
  { key: 'rm_stock',     label: 'RM Stock',          icon: '🗃️' },
  { key: 'settings',     label: 'Settings',          icon: '⚙️' },
  { key: 'admin',        label: 'Admin Panel',       icon: '🛡️' },
];

const ROLES = ['user', 'manager', 'admin', 'superadmin'];

const ROLE_COLORS = {
  guest:      { bg:'rgba(148,163,184,0.15)', color:'#94a3b8' },
  user:       { bg:'var(--primary-glow)',  color:'var(--primary-light)' },
  manager:    { bg:'rgba(168,85,247,0.15)',  color:'#c084fc' },
  admin:      { bg:'var(--accent-glow)',  color:'var(--accent)' },
  superadmin: { bg:'rgba(239,68,68,0.15)',   color:'#f87171' },
};

/* ─── Shared styles ─────────────────────────────────────── */
const S = {
  card: {
    background:'var(--surface)', backdropFilter:'blur(20px)',
    border:'1px solid var(--border)', borderRadius:14,
    padding:28, marginBottom:20,
  },
  input: {
    padding:'10px 14px', borderRadius:8,
    border:'1px solid var(--border)',
    background:'var(--bg-surface)', color:'var(--text)',
    fontSize:14, fontFamily:"var(--font-sans)",
    outline:'none', width:'100%', boxSizing:'border-box',
  },
  btn: (variant='primary') => ({
    padding:'9px 20px', border:'none', borderRadius:8, cursor:'pointer',
    fontFamily:"var(--font-heading)", fontWeight:700, fontSize:10,
    letterSpacing:1.5, textTransform:'uppercase', transition:'all 0.2s',
    ...(variant === 'primary' ? {
      background:'linear-gradient(135deg, var(--primary), var(--primary-light))', color:'#fff',
      boxShadow:'0 4px 16px var(--primary-glow)',
    } : variant === 'danger' ? {
      background:'rgba(239,68,68,0.15)', color:'#f87171',
      border:'1px solid rgba(239,68,68,0.3)',
    } : {
      background:'var(--surface-high)', color:'var(--text-mid)',
      border:'1px solid var(--border)',
    }),
  }),
  label: { fontSize:11, fontWeight:700, letterSpacing:2, color:'var(--text-muted)', textTransform:'uppercase', display:'block', marginBottom:6 },
  th: { padding:'10px 16px', textAlign:'left', fontSize:10, fontWeight:700, letterSpacing:2, color:'var(--text-muted)', textTransform:'uppercase', borderBottom:'1px solid var(--border)' },
  td: { padding:'12px 16px', fontSize:14, color:'var(--text-mid)', borderBottom:'1px solid var(--border)' },
};

/* ─── Sub-components ─────────────────────────────────────── */
function TabBtn({ label, icon, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      display:'flex', alignItems:'center', gap:8, padding:'10px 20px',
      border:'none', cursor:'pointer', borderRadius:10, transition:'all 0.2s',
      fontFamily:"var(--font-heading)", fontWeight:700, fontSize:10, letterSpacing:1.5,
      background: active ? 'linear-gradient(135deg, var(--primary), var(--primary-light))' : 'var(--primary-glow)',
      color: active ? '#fff' : 'var(--text-mid)',
      boxShadow: active ? '0 4px 16px var(--primary-glow)' : 'none',
    }}>
      <span style={{ fontSize:16 }}>{icon}</span> {label}
    </button>
  );
}

function RoleBadge({ role }) {
  const c = ROLE_COLORS[role] || ROLE_COLORS.user;
  return (
    <span style={{ padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:700, letterSpacing:1, textTransform:'uppercase', background:c.bg, color:c.color, border:`1px solid var(--border)` }}>
      {role}
    </span>
  );
}

function Toggle({ checked, onChange }) {
  return (
    <button onClick={() => onChange(!checked)} style={{
      width:44, height:24, borderRadius:12, border:'none', cursor:'pointer', padding:0,
      background: checked ? 'var(--primary)' : 'var(--surface-high)',
      position:'relative', transition:'background 0.2s', flexShrink:0,
    }}>
      <div style={{
        width:18, height:18, borderRadius:'50%', background:'#fff',
        position:'absolute', top:3,
        left: checked ? 23 : 3,
        transition:'left 0.2s', boxShadow:'0 2px 6px rgba(0,0,0,0.3)',
      }} />
    </button>
  );
}

/* ──────────────────────────────────────────────────────────
   TAB 1 — Companies
────────────────────────────────────────────────────────── */
function CompaniesTab() {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name:'', email:'', phone:'', address:'', website:'' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('companies').select('*').order('created_at', { ascending:false });
    setCompanies(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async (e) => {
    e.preventDefault();
    setSaving(true); setError(null);
    const { error } = await supabase.from('companies').insert([{ ...form, is_active: true }]);
    if (error) { setError(error.message); setSaving(false); return; }
    setForm({ name:'', email:'', phone:'', address:'', website:'' });
    setAdding(false);
    load();
    setSaving(false);
  };

  const toggleActive = async (id, val) => {
    await supabase.from('companies').update({ is_active: !val }).eq('id', id);
    load();
  };

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <h3 style={{ fontFamily:"var(--font-heading)", fontSize:16, color:'var(--text)', margin:0 }}>Companies</h3>
        <button style={S.btn('primary')} onClick={() => setAdding(!adding)}>+ Add Company</button>
      </div>

      <AnimatePresence>
        {adding && (
          <motion.div key="form" initial={{opacity:0,height:0}} animate={{opacity:1,height:'auto'}} exit={{opacity:0,height:0}} style={{ overflow:'hidden', marginBottom:20 }}>
            <div style={S.card}>
              <h4 style={{ fontFamily:"var(--font-heading)", fontSize:13, color:'var(--text-mid)', margin:'0 0 16px' }}>New Company</h4>
              {error && <div style={{ padding:'8px 12px', borderRadius:6, background:'rgba(239,68,68,0.12)', border:'1px solid rgba(239,68,68,0.3)', color:'#f87171', fontSize:13, marginBottom:12 }}>{error}</div>}
              <form onSubmit={handleAdd} style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
                <div style={{ gridColumn:'1/-1' }}>
                  <label style={S.label}>Company Name *</label>
                  <input style={S.input} required value={form.name} onChange={e => setForm(p=>({...p,name:e.target.value}))} placeholder="Acme Manufacturing" />
                </div>
                {['email','phone','address','website'].map(f => (
                  <div key={f}>
                    <label style={S.label}>{f}</label>
                    <input style={S.input} type={f==='email'?'email':'text'} value={form[f]} onChange={e => setForm(p=>({...p,[f]:e.target.value}))} placeholder={f==='email'?'admin@company.com':f==='phone'?'+91 98765 00000':f==='website'?'https://...':'123 Main St'} />
                  </div>
                ))}
                <div style={{ gridColumn:'1/-1', display:'flex', gap:10, justifyContent:'flex-end' }}>
                  <button type="button" style={S.btn('ghost')} onClick={() => setAdding(false)}>Cancel</button>
                  <button type="submit" style={S.btn()} disabled={saving}>{saving ? 'Saving…' : 'Create Company'}</button>
                </div>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div style={S.card}>
        {loading ? <div style={{ color:'rgba(255,255,255,0.4)', textAlign:'center', padding:24 }}>Loading…</div> : (
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr>
                {['Name','Email','Phone','Status','Actions'].map(h=><th key={h} style={S.th}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {companies.length === 0 && <tr><td colSpan={5} style={{ ...S.td, textAlign:'center', color:'var(--text-muted)' }}>No companies yet</td></tr>}
              {companies.map(co => (
                <tr key={co.id} style={{ transition:'background 0.15s' }}>
                  <td style={S.td}><span style={{ fontFamily:"var(--font-heading)", fontSize:13, color:'var(--text)' }}>{co.name}</span></td>
                  <td style={{ ...S.td, fontSize:13, color:'var(--text-mid)' }}>{co.email || '—'}</td>
                  <td style={{ ...S.td, fontSize:13, color:'var(--text-mid)' }}>{co.phone || '—'}</td>
                  <td style={S.td}>
                    <span style={{ padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:700, letterSpacing:1, background: co.is_active ? 'rgba(34,197,94,0.12)':'rgba(239,68,68,0.12)', color: co.is_active ? '#4ade80':'#f87171', border:`1px solid ${co.is_active?'rgba(74,222,128,0.3)':'rgba(248,113,113,0.3)'}` }}>
                      {co.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={S.td}>
                    <Toggle checked={co.is_active} onChange={() => toggleActive(co.id, co.is_active)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────
   TAB 2 — Users
────────────────────────────────────────────────────────── */
function UsersTab() {
  const [users, setUsers] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inviting, setInviting] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email:'', full_name:'', role:'user', company_id:'' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: u }, { data: c }] = await Promise.all([
      supabase.from('profiles').select('*, companies(name)').order('created_at', { ascending: false }),
      supabase.from('companies').select('id, name').eq('is_active', true),
    ]);
    setUsers(u || []);
    setCompanies(c || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleInvite = async (e) => {
    e.preventDefault();
    setSaving(true); setError(null); setSuccessMsg('');
    // Use Supabase Admin Invite (requires service role) or signUp
    const { error } = await supabase.auth.signUp({
      email: inviteForm.email,
      password: Math.random().toString(36).slice(-10) + 'A1!',
      options: { data: { full_name: inviteForm.full_name } }
    });
    if (error) { setError(error.message); setSaving(false); return; }
    // The trigger will create the profile row, but we need to update role + company
    // Wait a moment then update
    setTimeout(async () => {
      const { data: newProfile } = await supabase.from('profiles').select('id').eq('id', (await supabase.auth.admin?.listUsers())?.data?.users?.find(u=>u.email===inviteForm.email)?.id).single().catch(() => null) || {};
      if (newProfile?.id) {
        await supabase.from('profiles').update({ role: inviteForm.role, company_id: inviteForm.company_id || null }).eq('id', newProfile.id);
      }
      load();
    }, 1500);
    setSuccessMsg(`Invitation sent to ${inviteForm.email}. They can log in and change their password.`);
    setInviteForm({ email:'', full_name:'', role:'user', company_id:'' });
    setInviting(false);
    setSaving(false);
  };

  const changeRole = async (userId, newRole) => {
    await supabase.from('profiles').update({ role: newRole }).eq('id', userId);
    load();
  };

  const toggleUserActive = async (userId, val) => {
    await supabase.from('profiles').update({ is_active: !val }).eq('id', userId);
    load();
  };

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <h3 style={{ fontFamily:"var(--font-heading)", fontSize:16, color:'var(--text)', margin:0 }}>Users</h3>
        <button style={S.btn('primary')} onClick={() => setInviting(!inviting)}>+ Add User</button>
      </div>

      <AnimatePresence>
        {inviting && (
          <motion.div key="invform" initial={{opacity:0,height:0}} animate={{opacity:1,height:'auto'}} exit={{opacity:0,height:0}} style={{ overflow:'hidden', marginBottom:20 }}>
            <div style={S.card}>
              <h4 style={{ fontFamily:"var(--font-heading)", fontSize:13, color:'var(--text-mid)', margin:'0 0 16px' }}>Add New User</h4>
              {error && <div style={{ padding:'8px 12px', borderRadius:6, background:'rgba(239,68,68,0.12)', border:'1px solid rgba(239,68,68,0.3)', color:'#f87171', fontSize:13, marginBottom:12 }}>{error}</div>}
              {successMsg && <div style={{ padding:'8px 12px', borderRadius:6, background:'rgba(34,197,94,0.12)', border:'1px solid rgba(34,197,94,0.3)', color:'#4ade80', fontSize:13, marginBottom:12 }}>{successMsg}</div>}
              <form onSubmit={handleInvite} style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
                <div>
                  <label style={S.label}>Full Name</label>
                  <input style={S.input} required value={inviteForm.full_name} onChange={e=>setInviteForm(p=>({...p,full_name:e.target.value}))} placeholder="Jane Smith" />
                </div>
                <div>
                  <label style={S.label}>Email *</label>
                  <input style={S.input} type="email" required value={inviteForm.email} onChange={e=>setInviteForm(p=>({...p,email:e.target.value}))} placeholder="jane@company.com" />
                </div>
                <div>
                  <label style={S.label}>Role</label>
                  <select style={{ ...S.input, appearance:'none' }} value={inviteForm.role} onChange={e=>setInviteForm(p=>({...p,role:e.target.value}))}>
                    {ROLES.map(r=><option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label style={S.label}>Company</label>
                  <select style={{ ...S.input, appearance:'none' }} value={inviteForm.company_id} onChange={e=>setInviteForm(p=>({...p,company_id:e.target.value}))}>
                    <option value="">— None —</option>
                    {companies.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div style={{ gridColumn:'1/-1', display:'flex', gap:10, justifyContent:'flex-end' }}>
                  <button type="button" style={S.btn('ghost')} onClick={() => setInviting(false)}>Cancel</button>
                  <button type="submit" style={S.btn()} disabled={saving}>{saving ? 'Sending…' : 'Add User'}</button>
                </div>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div style={S.card}>
        {loading ? <div style={{ color:'rgba(255,255,255,0.4)', textAlign:'center', padding:24 }}>Loading…</div> : (
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr>
                {['Name','Email','Company','Role','Active','Actions'].map(h=><th key={h} style={S.th}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {users.length === 0 && <tr><td colSpan={6} style={{ ...S.td, textAlign:'center', color:'var(--text-muted)' }}>No users found</td></tr>}
              {users.map(u => (
                <tr key={u.id}>
                  <td style={S.td}>{u.full_name || '—'}</td>
                  <td style={{ ...S.td, fontSize:13, color:'var(--text-mid)' }}>{u.id?.slice(0,8)}…</td>
                  <td style={{ ...S.td, fontSize:13 }}>{u.companies?.name || <span style={{ color:'var(--text-muted)' }}>—</span>}</td>
                  <td style={S.td}>
                    <select
                      value={u.role}
                      onChange={e => changeRole(u.id, e.target.value)}
                      style={{ background:'var(--bg-surface)', border:'1px solid var(--border)', color:'var(--text)', borderRadius:6, padding:'4px 10px', fontFamily:"var(--font-sans)", fontSize:13, cursor:'pointer', ...ROLE_COLORS[u.role] && { color: ROLE_COLORS[u.role].color } }}
                    >
                      {['guest',...ROLES].map(r=><option key={r} value={r}>{r}</option>)}
                    </select>
                  </td>
                  <td style={S.td}><Toggle checked={u.is_active} onChange={() => toggleUserActive(u.id, u.is_active)} /></td>
                  <td style={S.td}>
                    <RoleBadge role={u.role} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────
   TAB 3 — Access Control
────────────────────────────────────────────────────────── */
function AccessControlTab() {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [accessMap, setAccessMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('profiles').select('id, full_name, role').order('full_name');
    setUsers(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const loadAccess = async (userId) => {
    setSelectedUser(userId);
    const { data } = await supabase
      .from('settings_values')
      .select('value')
      .eq('user_id', userId)
      .eq('setting_key', 'page_access')
      .maybeSingle();

    if (data?.value) {
      setAccessMap(JSON.parse(data.value));
    } else {
      // Default: all modules enabled
      const defaults = {};
      MODULES.forEach(m => { defaults[m.key] = true; });
      setAccessMap(defaults);
    }
  };

  const saveAccess = async () => {
    if (!selectedUser) return;
    setSaving(true); setSaved(false);
    const selectedProfile = users.find(u => u.id === selectedUser);
    await supabase.from('settings_values').upsert({
      user_id: selectedUser,
      company_id: selectedProfile?.company_id || null,
      setting_key: 'page_access',
      value: JSON.stringify(accessMap),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,setting_key' });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const toggleModule = (key) => {
    setAccessMap(prev => ({ ...prev, [key]: !prev[key] }));
    setSaved(false);
  };

  const grantAll = () => { const a = {}; MODULES.forEach(m => a[m.key]=true); setAccessMap(a); };
  const revokeAll = () => { const a = {}; MODULES.forEach(m => a[m.key]=false); setAccessMap(a); };

  return (
    <div style={{ display:'grid', gridTemplateColumns:'260px 1fr', gap:20 }}>
      {/* User list sidebar */}
      <div>
        <h3 style={{ fontFamily:"var(--font-heading)", fontSize:14, color:'var(--text-mid)', marginBottom:14, marginTop:0 }}>Select User</h3>
        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
          {loading && <div style={{ color:'var(--text-muted)', fontSize:13 }}>Loading…</div>}
          {users.map(u => (
            <button key={u.id} onClick={() => loadAccess(u.id)} style={{
              display:'flex', alignItems:'center', justifyContent:'space-between',
              padding:'10px 14px', borderRadius:10, border:'1px solid',
              cursor:'pointer', textAlign:'left', transition:'all 0.15s',
              background: selectedUser===u.id ? 'var(--primary-glow)' : 'var(--glass)',
              borderColor: selectedUser===u.id ? 'var(--primary)' : 'var(--border)',
            }}>
              <span style={{ fontFamily:"var(--font-sans)", fontWeight:600, fontSize:14, color:'var(--text)' }}>
                {u.full_name || 'Unnamed'}
              </span>
              <RoleBadge role={u.role} />
            </button>
          ))}
        </div>
      </div>

      {/* Access toggles */}
      <div>
        {!selectedUser ? (
          <div style={{ ...S.card, display:'flex', alignItems:'center', justifyContent:'center', minHeight:200, color:'var(--text-muted)', fontSize:14 }}>
            Select a user to manage their module access →
          </div>
        ) : (
          <div style={S.card}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
              <h3 style={{ fontFamily:"var(--font-heading)", fontSize:14, color:'var(--text)', margin:0 }}>
                Module Access — {users.find(u=>u.id===selectedUser)?.full_name || 'User'}
              </h3>
              <div style={{ display:'flex', gap:8 }}>
                <button style={S.btn('ghost')} onClick={grantAll}>Grant All</button>
                <button style={S.btn('danger')} onClick={revokeAll}>Revoke All</button>
                <button style={S.btn('primary')} onClick={saveAccess} disabled={saving}>
                  {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save Access'}
                </button>
              </div>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              {MODULES.map(mod => (
                <div key={mod.key} style={{
                  display:'flex', alignItems:'center', justifyContent:'space-between',
                  padding:'14px 16px', borderRadius:10,
                  background: accessMap[mod.key] ? 'var(--primary-glow)' : 'var(--surface-high)',
                  border:`1px solid ${accessMap[mod.key] ? 'var(--primary)' : 'var(--border)'}`,
                  transition:'all 0.2s',
                }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <span style={{ fontSize:20 }}>{mod.icon}</span>
                    <div>
                      <div style={{ fontFamily:"var(--font-sans)", fontWeight:700, fontSize:14, color: accessMap[mod.key] ? 'var(--text)' : 'var(--text-muted)' }}>
                        {mod.label}
                      </div>
                      <div style={{ fontSize:11, color: accessMap[mod.key] ? 'var(--primary)' : 'var(--text-muted)' }}>
                        {accessMap[mod.key] ? 'Access Granted' : 'Access Denied'}
                      </div>
                    </div>
                  </div>
                  <Toggle checked={!!accessMap[mod.key]} onChange={() => toggleModule(mod.key)} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────
   MAIN ADMIN PANEL
────────────────────────────────────────────────────────── */
export default function AdminPanel() {
  const [tab, setTab] = useState('companies');
  const { user } = useAuth();

  const tabs = [
    { key:'companies',     label:'Companies',      icon:'🏢' },
    { key:'users',         label:'Users',          icon:'👥' },
    { key:'access',        label:'Access Control', icon:'🛡️' },
  ];

  return (
    <div style={{
      minHeight:'100vh',
      background:'var(--bg)',
      padding:'80px 40px 40px',
      fontFamily:"var(--font-sans)",
      color: 'var(--text)',
    }}>
      {/* Grid overlay */}
      <div style={{ position:'fixed', inset:0, backgroundImage:'linear-gradient(rgba(0,85,187,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(0,85,187,0.03) 1px,transparent 1px)', backgroundSize:'48px 48px', pointerEvents:'none' }} />

      <div style={{ maxWidth:1200, margin:'0 auto', position:'relative', zIndex:1 }}>
        {/* Header */}
        <div style={{ marginBottom:32 }}>
          <div style={{ fontFamily:"var(--font-heading)", fontSize:10, letterSpacing:4, color:'var(--primary)', textTransform:'uppercase', marginBottom:6 }}>
            🛡️ Administrator
          </div>
          <h1 style={{ fontFamily:"var(--font-heading)", fontSize:28, fontWeight:900, color:'var(--text)', margin:0 }}>
            Admin <span style={{ color:'var(--primary)' }}>Panel</span>
          </h1>
          <p style={{ color:'var(--text-muted)', marginTop:6, fontSize:15 }}>
            Manage companies, users, roles, and module access control.
          </p>
        </div>

        {/* Tabs */}
        <div style={{ display:'flex', gap:10, marginBottom:28, flexWrap:'wrap' }}>
          {tabs.map(t => <TabBtn key={t.key} label={t.label} icon={t.icon} active={tab===t.key} onClick={() => setTab(t.key)} />)}
        </div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          <motion.div key={tab} initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-6 }} transition={{ duration:0.18 }}>
            {tab === 'companies'  && <CompaniesTab />}
            {tab === 'users'      && <UsersTab />}
            {tab === 'access'     && <AccessControlTab />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
