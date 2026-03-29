import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { useTheme } from '../../contexts/ThemeContext';

export default function Appearance() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState('');
  const { reloadTheme } = useTheme();

  // Local state for the settings form
  const [settings, setSettings] = useState({
    theme: 'system',
    primaryColor: '#0055bb',
    fontSize: 14,
    sidebarStyle: 'expanded',
    layout: 'default'
  });

  // Load existing settings when the component mounts
  useEffect(() => {
    fetchAppearanceSettings();
  }, []);

  const fetchAppearanceSettings = async () => {
    try {
      setLoading(true);
      setError(null);

      // We use maybeSingle() because the row might not exist yet for this user/company
      // Note: RLS usually ties this to the logged-in user, but for demoing we'll just fetch
      // the first match we can access (or you can query by auth.uid() explicitly, though RLS does this).
      const { data, error } = await supabase
        .from('appearance_settings')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (data) {
        setSettings({
          theme: data.theme || 'system',
          primaryColor: data.primary_color || '#0055bb',
          fontSize: data.font_size || 14,
          sidebarStyle: data.sidebar_style || 'expanded',
          layout: data.layout || 'default'
        });
      }
    } catch (err) {
      console.error('Error fetching appearance settings:', err.message);
      setError('Could not load existing settings or no active session.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccessMsg('');

    try {
      // Since COMPANY_ID is NOT NULL in db.sql, we need to ensure the user is logged in
      // and let RLS / backend handle the upsert, or we fetch their profile first.
      
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData?.user) {
        throw new Error('You must be logged in to save settings.');
      }

      // We should ideally upsert into APPEARANCE_SETTINGS.
      // Assuming RLS and trigger logic handles COMPANY_ID context, or we must provide it.
      // Often with Supabase you'd use an upsert pointing to the user's ID.
      
      // Let's get the user's company_id from their profile first
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', userData.user.id)
        .single();
        
      if (profileError || !profileData?.company_id) {
        throw new Error('No company context found for this user.');
      }

      const upsertData = {
        company_id: profileData.company_id,
        user_id: userData.user.id,
        theme: settings.theme,
        primary_color: settings.primaryColor,
        font_size: parseInt(settings.fontSize, 10),
        sidebar_style: settings.sidebarStyle,
        layout: settings.layout,
        updated_at: new Date().toISOString(),
      };

      const { error: upsertError } = await supabase
        .from('appearance_settings')
        .upsert(upsertData, { onConflict: 'company_id,user_id' });

      if (upsertError) {
        throw upsertError;
      }

      setSuccessMsg('Appearance settings saved successfully!');
      reloadTheme(); // Apply the new theme immediately
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMsg(''), 3000);

    } catch (err) {
      console.error('Error saving appearance settings:', err.message);
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setSettings((prev) => ({
      ...prev,
      [name]: value
    }));
  };

  if (loading) {
    return <div style={{ padding: '40px', fontFamily: "'Rajdhani', sans-serif" }}>Loading Appearance Settings...</div>;
  }

  return (
    <div style={{ padding: '40px', maxWidth: '800px', margin: '0 auto', fontFamily: "'Rajdhani', sans-serif", color: 'var(--text, #0c1f38)' }}>
      <h2 style={{ fontFamily: "var(--font-heading)", fontSize: '28px', color: 'var(--primary)', marginBottom: '24px' }}>
        Appearance Settings
      </h2>

      {error && (
        <div style={{ padding: '12px 16px', background: '#ffebee', color: '#c62828', borderLeft: '4px solid #c62828', marginBottom: '20px', borderRadius: '4px', fontWeight: 600 }}>
          {error}
        </div>
      )}

      {successMsg && (
        <div style={{ padding: '12px 16px', background: '#e8f5e9', color: '#2e7d32', borderLeft: '4px solid #2e7d32', marginBottom: '20px', borderRadius: '4px', fontWeight: 600 }}>
          {successMsg}
        </div>
      )}

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '24px', background: 'var(--surface)', backdropFilter: 'blur(12px)', padding: '32px', borderRadius: '12px', border: '1px solid var(--border)', boxShadow: 'var(--shadow)' }}>
        
        {/* Theme Selection */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ fontSize: '14px', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--text-mid)' }}>Theme</label>
          <select 
            name="theme" 
            value={settings.theme} 
            onChange={handleChange}
            style={{ padding: '12px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text)', outline: 'none', fontFamily: 'inherit', fontSize: '15px' }}
          >
            <option value="light">Light</option>
            <option value="dark">Dark</option>
            <option value="system">System Default</option>
          </select>
        </div>

        {/* Primary Color */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ fontSize: '14px', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--text-mid)' }}>Primary Accent Color</label>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <input 
              type="color" 
              name="primaryColor" 
              value={settings.primaryColor} 
              onChange={handleChange}
              style={{ width: '48px', height: '48px', padding: '0', border: 'none', borderRadius: '8px', cursor: 'pointer', background: 'transparent' }}
            />
            <input 
              type="text" 
              name="primaryColor" 
              value={settings.primaryColor} 
              onChange={handleChange}
              placeholder="#0055bb"
              style={{ flex: 1, padding: '12px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text)', outline: 'none', fontFamily: "var(--font-mono)" }}
            />
          </div>
        </div>

        {/* Font Size */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ fontSize: '14px', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--text-mid)' }}>Base Font Size (px): {settings.fontSize}px</label>
          <input 
            type="range" 
            name="fontSize" 
            min="12" 
            max="24" 
            value={settings.fontSize} 
            onChange={handleChange}
            style={{ width: '100%', cursor: 'pointer', accentColor: 'var(--primary)' }}
          />
        </div>

        {/* Sidebar Style */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ fontSize: '14px', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--text-mid)' }}>Sidebar Style</label>
          <select 
            name="sidebarStyle" 
            value={settings.sidebarStyle} 
            onChange={handleChange}
            style={{ padding: '12px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text)', outline: 'none', fontFamily: 'inherit', fontSize: '15px' }}
          >
            <option value="expanded">Expanded</option>
            <option value="compact">Compact</option>
            <option value="icon_only">Icon Only</option>
            <option value="floating">Floating</option>
          </select>
        </div>

        {/* Layout */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ fontSize: '14px', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--text-mid)' }}>Layout Preference</label>
          <select 
            name="layout" 
            value={settings.layout} 
            onChange={handleChange}
            style={{ padding: '12px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text)', outline: 'none', fontFamily: 'inherit', fontSize: '15px' }}
          >
            <option value="default">Default</option>
            <option value="fluid">Fluid (100% Width)</option>
            <option value="boxed">Boxed (Max Width)</option>
          </select>
        </div>

        <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
          <button 
            type="submit" 
            disabled={saving}
            className="btn-primary"
            style={{ 
              background: 'var(--primary)', color: 'white', border: 'none', 
              padding: '12px 32px', borderRadius: '4px', cursor: saving ? 'not-allowed' : 'pointer',
              fontFamily: "var(--font-heading)", fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase',
              opacity: saving ? 0.7 : 1, transition: 'background 0.3s',
              boxShadow: 'var(--primary-glow)'
            }}
          >
            {saving ? 'Saving...' : 'Save Appearance'}
          </button>
        </div>

      </form>
    </div>
  );
}
