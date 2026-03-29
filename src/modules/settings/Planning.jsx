import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useParams, useNavigate } from 'react-router-dom';
import SortMasterSettings from '../planSettings/SortMasterSettings';
import ExclusionItems from '../planSettings/ExclusionItems';
import ChildParts from '../planSettings/ChildParts';
import InputSettings from '../planSettings/InputSettings';

import { Settings, Ban, Puzzle, DownloadCloud } from 'lucide-react';

const TABS = [
  { id: 'sort-master', label: 'Sort Master', icon: <Settings size={14} /> },
  { id: 'exclusion-items', label: 'Exclusion Items', icon: <Ban size={14} /> },
  { id: 'child-parts', label: 'Child Parts', icon: <Puzzle size={14} /> },
  { id: 'input-selection', label: 'Selecting Inputs', icon: <DownloadCloud size={14} /> },
];

export default function Planning() {
  const { tabId } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(tabId || 'sort-master');

  useEffect(() => {
    if (tabId) setActiveTab(tabId);
  }, [tabId]);

  const handleTabChange = (id) => {
    setActiveTab(id);
    navigate(`/settings/planning/${id}`);
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      padding: '2.5rem 3rem',
      fontFamily: "var(--font-sans)",
      color: 'var(--text)',
      paddingTop: '88px'
    }}>
      {/* Header */}
      <div style={{ marginBottom: '2.5rem' }}>
        <div style={{ 
          fontFamily: "var(--font-heading)", 
          fontSize: '0.65rem', 
          fontWeight: 800,
          letterSpacing: '0.2em', 
          color: 'var(--primary)', 
          textTransform: 'uppercase', 
          marginBottom: '0.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <div style={{ height: '1px', width: '20px', background: 'var(--primary)', opacity: 0.5 }}></div>
          Planning Engine
        </div>
        <h1 style={{ fontFamily: "var(--font-heading)", fontSize: '1.85rem', fontWeight: 900, color: 'var(--text)', margin: 0, letterSpacing: '-0.02em' }}>
          Configuration <span style={{ color: 'var(--primary)' }}>Hub</span>
        </h1>
        <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem', fontSize: '0.9rem', maxWidth: '600px', lineHeight: 1.6 }}>
          Fine-tune the sorting logic, manage exclusions, and define assembly hierarchies to optimize your production throughput.
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.65rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => handleTabChange(tab.id)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.65rem', padding: '0.75rem 1.25rem',
              border: 'none', cursor: 'pointer', borderRadius: '12px', transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
              fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.06em',
              background: activeTab === tab.id ? 'var(--primary)' : 'var(--surface-low)',
              color: activeTab === tab.id ? '#fff' : 'var(--text-mid)',
              boxShadow: activeTab === tab.id ? '0 8px 16px color-mix(in srgb, var(--primary) 25%, transparent)' : '0 2px 4px rgba(0,0,0,0.02)',
              border: `1px solid ${activeTab === tab.id ? 'var(--primary)' : 'var(--border)'}`
            }}
          >
            <span style={{ opacity: activeTab === tab.id ? 1 : 0.7 }}>{tab.icon}</span> 
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div style={{ 
        background: 'var(--glass)', 
        backdropFilter: 'blur(24px) saturate(180%)',
        WebkitBackdropFilter: 'blur(24px) saturate(180%)',
        border: '1px solid var(--border)', 
        borderRadius: '20px',
        minHeight: '400px',
        boxShadow: '0 8px 32px rgba(15, 23, 42, 0.08)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
          >
            {activeTab === 'sort-master' && <SortMasterSettings />}
            {activeTab === 'exclusion-items' && <ExclusionItems />}
            {activeTab === 'child-parts' && <ChildParts />}
            {activeTab === 'input-selection' && <InputSettings />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
