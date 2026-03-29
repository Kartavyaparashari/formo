import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../supabaseClient';
import '../../assets/styles/components/Navbar.css';

import { 
  Home, 
  Settings, 
  Info, 
  Mail, 
  Download, 
  FileText, 
  Box, 
  BarChart3, 
  Cpu, 
  Scan, 
  Package, 
  ShieldCheck, 
  LayoutDashboard,
  LogOut,
  LogIn,
  User,
  Search,
  ChevronDown as LucideChevronDown
} from 'lucide-react';

const icons = {
  home:     <Home size={16} />,
  services: <Cpu size={16} />,
  about:    <Info size={16} />,
  contact:  <Mail size={16} />,
  import:   <Download size={16} />,
  plan:     <FileText size={16} />,
  material: <Box size={16} />,
  reports:  <BarChart3 size={16} />,
  ai:       <LayoutDashboard size={16} />,
  scan:     <Scan size={16} />,
  stock:    <Package size={16} />,
  planset:  <Settings size={16} />,
  settings: <Settings size={16} />,
  chevron:  <LucideChevronDown size={10} />,
  admin:    <ShieldCheck size={14} />,
  logout:   <LogOut size={14} />,
  login:    <LogIn size={14} />,
  user:     <User size={16} />,
};

const ChevronDown = ({ isOpen }) => (
  <svg className={`nav-chevron ${isOpen ? 'is-open' : ''}`} width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

/* ── Route Map ───────────────────────────────────────────── */
const ROUTE_MAP = {
  'Home Page':                      '/',
  'IPO Import':                     '/import/ipo',
  'Barcode Detail Import':          '/import/barcode',
  'PNL SEC and SPL Masters Import': '/import/pnl-master',
  'Sort Master':                    '/plan/sort-master',
  'Sort Master Config':             '/settings/planning/sort-master',
  'Exclusion Items':                '/settings/planning/exclusion-items',
  'Child Parts':                    '/settings/planning/child-parts',
  'PNL Planning':                     '/plan/pnl',
  'SEC Planning':                     '/plan/sec',
  'SPL Planning':                     '/plan/spl',
  'RM Calculation':                 '/material/rm-calc',
  'Items Modification':             '/material/items-mod',
  'Production':                      '/reports/production',
  'MIS Report':                      '/reports/mis',
  'Lot Wise Report + Unit Wise Report': '/reports/lot-wise',
  'Analysis of Production Graph':   '/reports/graph',
  'Appearance':                     '/settings/appearance',
  'Admin Panel':                    '/admin',
};

/* Scroll targets (anchor sections on home page) */
const SCROLL_TARGETS = ['Services', 'About Us', 'Contact Us'];

const menu = [
  { label: 'Home Page', icon: 'home',    module_key: 'home' },
  {
    label: 'Plan', icon: 'plan', module_key: 'plan',
    items: [
      { name: 'Sort Master',                desc: 'Configure sort order' },
      { name: 'PNL Planning',               desc: 'Panel planning' },
      { name: 'SEC Planning',               desc: 'Section planning' },
      { name: 'SPL Planning',               desc: 'Special planning' },
    ],
  },
  { label: 'Services', icon: 'services', module_key: 'public' },
  { label: 'About Us', icon: 'about',    module_key: 'public' },
  { label: 'Contact Us', icon: 'contact', module_key: 'public' },
  {
    label: 'Import', icon: 'import', module_key: 'import',
    items: [
      { name: 'IPO Import',                     desc: 'Import IPO data' },
      { name: 'Barcode Detail Import',           desc: 'Import barcode details' },
      { name: 'PNL SEC and SPL Masters Import',  desc: 'Import master data' },
    ],
  },
  {
    label: 'Material Operations', icon: 'material', module_key: 'material_ops',
    items: [
      { name: 'RM Calculation',    desc: 'Raw material calc' },
      { name: 'Items Modification', desc: 'Modify item data' },
    ],
  },
  {
    label: 'Reports', icon: 'reports', module_key: 'reports',
    items: [
      { name: 'Production',                                desc: 'Production reports' },
      { name: 'MIS Report',                                desc: 'MIS summaries' },
      { name: 'Lot Wise Report + Unit Wise Report',        desc: 'Lot & unit reports' },
      { name: 'Analysis of Production Graph',              desc: 'Visual analytics' },
    ],
  },
  {
    label: 'AI Chatbot', icon: 'ai', module_key: 'ai_chatbot',
    items: [
      { name: 'To Get RM Calculation Plan Creation and Much More', desc: 'AI assistant' },
    ],
  },
  {
    label: 'Scan', icon: 'scan', module_key: 'scan',
    items: [{ name: 'Check Item Detail', desc: 'Scan & verify items' }],
  },
  {
    label: 'RM Stock', icon: 'stock', module_key: 'rm_stock',
    items: [{ name: 'RM Stock details', desc: 'Stock overview' }],
  },
  {
    label: 'Plan Settings', icon: 'planset', module_key: 'plan_settings',
    items: [
      { name: 'Sort Master Config',     desc: 'Configure sort rules' },
      { name: 'Exclusion Items', desc: 'Manage exclusions' },
      { name: 'Child Parts',     desc: 'Child part config' },
    ],
  },
  {
    label: 'Settings', icon: 'settings', module_key: 'settings',
    items: [
      { name: 'User Management', desc: 'Manage users' },
      { name: 'Appearance',      desc: 'Theme & display' },
      { name: 'Security',        desc: 'Security settings' },
      { name: 'Company',         desc: 'Company profile' },
      { name: 'Masters',         desc: 'Master data' },
      { name: 'Planning',        desc: 'Planning config' },
      { name: 'Reports',         desc: 'Report settings' },
      { name: 'AI Settings',     desc: 'AI configuration' },
      { name: 'Notifications',   desc: 'Alert settings' },
      { name: 'Backup',          desc: 'Backup & restore' },
    ],
  },
];

/* ── Navbar Component ────────────────────────────────────── */
export default function Navbar() {
  const [activeDropdown, setActiveDropdown] = useState(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const navRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile, loading: authLoading, signOut } = useAuth();
  const [pageAccess, setPageAccess] = useState({});

  /* ── Fetch page access ── */
  useEffect(() => {
    if (!user) return;
    supabase.from('settings_values')
      .select('value')
      .eq('user_id', user.id)
      .eq('setting_key', 'page_access')
      .maybeSingle()
      .then(({ data }) => {
        if (data?.value) {
          try { setPageAccess(JSON.parse(data.value)); }
          catch (e) { console.error("Error parsing page_access:", e); }
        }
      });
  }, [user]);

  /* ── Navigation handler ── */
  const handleNav = (target) => {
    // Route-mapped pages
    if (ROUTE_MAP[target]) {
      navigate(ROUTE_MAP[target]);
    }
    // Scroll targets on the home page
    else if (SCROLL_TARGETS.includes(target)) {
      if (location.pathname !== '/') navigate('/');
      setTimeout(() => {
        const id = target.toLowerCase().replace(/\s+/g, '');
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
      }, 50);
    }
    setActiveDropdown(null);
    setIsMobileMenuOpen(false);
  };

  /* ── Filter menu by role & page access ── */
  const filteredMenu = menu.filter(item => {
    if (!user) return item.module_key === 'home' || item.module_key === 'public';
    if (authLoading || !profile) return item.module_key === 'home' || item.module_key === 'public';
    return (
      ['admin', 'superadmin'].includes(profile.role) ||
      pageAccess[item.module_key] === true ||
      item.module_key === 'home' ||
      item.module_key === 'public'
    );
  });

  const mainNavItems = filteredMenu.slice(0, 5);
  const moreNavItems = filteredMenu.slice(5);

  /* ── Scroll / click-outside / resize listeners ── */
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const onClickOutside = (e) => {
      if (navRef.current && !navRef.current.contains(e.target)) setActiveDropdown(null);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  useEffect(() => {
    const onResize = () => { if (window.innerWidth > 1024) setIsMobileMenuOpen(false); };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  /* ── User initials for avatar badge ── */
  const initials = profile?.full_name
    ? profile.full_name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : user?.email?.[0]?.toUpperCase() || '?';

  /* ── Helper to check if a tab (or its children) is active ── */
  const isTabActive = (menuItem, idx) => {
    // If the dropdown itself is open, it counts as active
    if (activeDropdown === idx) return true;

    // If it's a direct link (no sub-items)
    if (!menuItem.items) {
      return location.pathname === ROUTE_MAP[menuItem.label];
    }

    // If any of the sub-items match the current path
    return menuItem.items.some(sub => location.pathname === ROUTE_MAP[sub.name]);
  };

  /* ── Render helpers ── */
  const renderDropdown = (menuItem, dropdownId) => (
    <AnimatePresence>
      {menuItem.items && activeDropdown === dropdownId && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 5 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="navbar-dropdown-panel"
        >
          <div className="navbar-dropdown-header">{menuItem.label}</div>
          {menuItem.items.map((sub, i) => {
            const isActive = location.pathname === ROUTE_MAP[sub.name];
            return (
              <a 
                key={i} 
                href="#" 
                onClick={(e) => { e.preventDefault(); handleNav(sub.name); }} 
                className={`navbar-dropdown-link ${isActive ? 'is-active' : ''}`}
              >
                <span className="navbar-dropdown-link-name">{sub.name}</span>
                <span className="navbar-dropdown-link-desc">{sub.desc}</span>
              </a>
            );
          })}
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <motion.header
      ref={navRef}
      className={`navbar-header ${scrolled ? 'is-scrolled' : ''}`}
    >
      <div className="navbar-inner">
        <div className="navbar-brand" onClick={() => handleNav('Home Page')}>
          <div className="navbar-logo">
            <span className="navbar-logo-main">FORM</span>
            <span className="navbar-logo-accent">O</span>
          </div>
          <div className="navbar-version-badge">
            <span className="navbar-brand-version">v3.1</span>
          </div>
        </div>

        {/* ── Search (Professional SaaS Tool) ── */}
        <div className="navbar-search-trigger hide-mobile">
          <Search size={14} className="navbar-search-icon" />
          <span className="navbar-search-text">Search...</span>
          <kbd className="navbar-search-kbd">⌘K</kbd>
        </div>

        {/* ── Hamburger ── */}
        <button className="navbar-hamburger" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} aria-label="Toggle Menu">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {isMobileMenuOpen
              ? <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>
              : <><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></>}
          </svg>
        </button>

        {/* ── Nav Links ── */}
        <nav className={`navbar-nav ${isMobileMenuOpen ? 'is-open' : ''}`}>
          {mainNavItems.map((item, idx) => (
            <div key={idx} className="navbar-item">
              <button
                className={`nav-link ${isTabActive(item, idx) ? 'is-active' : ''}`}
                onClick={(e) => {
                  e.preventDefault();
                  if (!item.items) {
                    handleNav(item.label);
                  } else {
                    setActiveDropdown(activeDropdown === idx ? null : idx);
                  }
                }}
              >
                <span className="nav-link-icon">{icons[item.icon]}</span>
                <span className="nav-link-label">{item.label}</span>
                {item.items && <ChevronDown isOpen={activeDropdown === idx} />}
              </button>
              {renderDropdown(item, idx)}
            </div>
          ))}

          {/* ── MORE mega-menu ── */}
          {moreNavItems.length > 0 && (
            <div className="navbar-item">
              <button
                className={`nav-link ${activeDropdown === 'more' ? 'is-active' : ''}`}
                onClick={() => setActiveDropdown(activeDropdown === 'more' ? null : 'more')}
              >
                <span className="nav-link-label">More</span>
                <ChevronDown isOpen={activeDropdown === 'more'} />
              </button>
              <AnimatePresence>
                {activeDropdown === 'more' && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 4, scale: 0.98 }}
                    transition={{ duration: 0.18, ease: 'easeOut' }}
                    className="navbar-dropdown-panel navbar-mega-panel"
                  >
                    <div className="navbar-mega-grid">
                      {moreNavItems.map((group, idx) => (
                        <div key={idx} className="navbar-mega-group">
                          <div className="navbar-mega-group-title">
                            <span className="navbar-mega-group-icon">{icons[group.icon]}</span>
                            {group.label}
                          </div>
                          {group.items?.map((sub, si) => (
                            <a key={si} href="#" onClick={(e) => { e.preventDefault(); handleNav(sub.name); }} className="navbar-dropdown-link">
                              <span className="navbar-dropdown-link-name">{sub.name}</span>
                              <span className="navbar-dropdown-link-desc">{sub.desc}</span>
                            </a>
                          ))}
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </nav>

        {/* ── Right side actions ── */}
        <div className="navbar-actions">
          {user && profile && ['admin', 'superadmin'].includes(profile.role) && (
            <button className="navbar-btn navbar-btn-admin hide-mobile" onClick={() => handleNav('Admin Panel')}>
              {icons.admin}
              <span>Admin</span>
            </button>
          )}

          {user ? (
            <div className="navbar-user-group hide-mobile">
              <div className="navbar-avatar" title={profile?.full_name || user.email}>{initials}</div>
              <button className="navbar-btn navbar-btn-signout" onClick={() => { signOut(); navigate('/'); }}>
                {icons.logout}
                <span>Sign Out</span>
              </button>
            </div>
          ) : (
            <button className="navbar-btn navbar-btn-login hide-mobile" onClick={() => navigate('/auth')}>
              {icons.login}
              <span>Log In</span>
            </button>
          )}
        </div>
      </div>
    </motion.header>
  );
}
