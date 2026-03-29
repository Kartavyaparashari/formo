import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../contexts/AuthContext';
import Button from '../../components/ui/Button';
import Select from '../../components/ui/Select';
import Loader from '../../components/ui/Loader';

const S = {
  card: {
    background: 'var(--surface)', backdropFilter: 'blur(20px)',
    border: '1px solid var(--border)', borderRadius: 14,
    padding: 24, maxWidth: 600, margin: '20px auto'
  },
  label: { fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 12 },
  info: { fontSize: 13, color: 'var(--text-muted)', marginTop: 16, lineHeight: 1.6 }
};

export default function InputSettings() {
  const { user, profile } = useAuth();
  const [source, setSource] = useState('supabase');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const loadSetting = useCallback(async () => {
    if (!user || !profile?.company_id) return;
    setLoading(true);
    
    const { data, error } = await supabase
      .from('settings_values')
      .select('value')
      .eq('company_id', profile.company_id)
      .eq('setting_key', 'planning_input_source')
      .maybeSingle();

    if (data?.value) {
      setSource(data.value);
    }
    setLoading(false);
  }, [user, profile]);

  useEffect(() => { loadSetting(); }, [loadSetting]);

  const handleSave = async () => {
    if (!profile?.company_id) return;
    setSaving(true); setError(null); setSuccess(false);
    
    const { error } = await supabase
      .from('settings_values')
      .upsert({ 
        company_id: profile.company_id,
        user_id: user.id, // Optional: make it global by leaving NULL if preferred, but schema UNIQUE constraint includes user_id
        setting_key: 'planning_input_source',
        value: source,
        updated_at: new Date().toISOString()
      }, { onConflict: 'company_id, user_id, setting_key' });

    if (error) {
      setError(error.message);
    } else {
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    }
    setSaving(false);
  };

  if (loading) return <div style={{ display:'flex', justifyContent:'center', padding:50 }}><Loader /></div>;

  return (
    <div style={{ padding: 20 }}>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={S.card}>
        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 18, marginBottom: 20 }}>Selecting <span style={{ color: 'var(--primary)' }}>Inputs</span></h2>
        
        <div style={{ marginBottom: 24 }}>
          <label style={S.label}>Default Planning Data Source</label>
          <Select value={source} onChange={e => setSource(e.target.value)}>
            <option value="supabase">Supabase Database (Internal)</option>
            <option value="excel">Excel Sheet (Manual Import)</option>
          </Select>
          
          <div style={S.info}>
            {source === 'supabase' ? (
              <p>Choosing <strong>Supabase</strong> will fetch planning items directly from the <code>PNL-MASTER</code> table. This is the recommended setting for real-time data synchronization.</p>
            ) : (
              <p>Choosing <strong>Excel</strong> will require you to manually upload an Excel file each time you generate a new plan. This is useful for offline workflows or legacy data migration.</p>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12 }}>
          {success && <span style={{ color: '#22c55e', fontSize: 12, fontWeight: 600 }}>✓ Settings Saved</span>}
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Configuration"}
          </Button>
        </div>
        
        {error && <p style={{ color: 'var(--danger)', fontSize: 12, marginTop: 12 }}>{error}</p>}
      </motion.div>
    </div>
  );
}
