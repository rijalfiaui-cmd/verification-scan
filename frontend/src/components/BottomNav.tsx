import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import './BottomNav.css';
import Icon from './Icon';

const BottomNav: React.FC = () => {
  const { pathname } = useLocation();
  return (
    <nav className="nav-tabs safe-bottom">
      <NavLink
        to="/scan"
        className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`}
        id="nav-scan"
      >
        <Icon className="nav-tab-icon" name="camera" />
        <span>Scan QR</span>
      </NavLink>
      <NavLink
        to="/admin"
        className={({ isActive }) => `nav-tab ${isActive || pathname === '/beneficiaries-3b' ? 'active' : ''}`}
        id="nav-admin"
      >
        <Icon className="nav-tab-icon" name="users" />
        <span>Penerima Manfaat</span>
      </NavLink>
      <NavLink
        to="/attendance"
        className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`}
        id="nav-attendance"
      >
        <Icon className="nav-tab-icon" name="chart" />
        <span>Rekap</span>
      </NavLink>
    </nav>
  );
};

export default BottomNav;
