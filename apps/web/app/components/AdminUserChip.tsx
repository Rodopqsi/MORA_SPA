"use client";

import { useEffect, useState } from 'react';
import { getToken } from '../lib/auth';

type StaffPayload = {
  sub: string | number;
  username?: string;
  roles?: string[];
  kind?: string;
};

const decodeJwt = (token: string): StaffPayload | null => {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const padded = part.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = typeof atob === 'function' ? atob(padded) : Buffer.from(padded, 'base64').toString('utf-8');
    return JSON.parse(decoded) as StaffPayload;
  } catch {
    return null;
  }
};

const initialsOf = (value: string): string => {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'AD';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const formatRole = (role?: string): string => {
  if (!role) return 'Equipo';
  const map: Record<string, string> = {
    ADMIN: 'Administrador',
    RECEPCION: 'Recepcion',
    ESTILISTA: 'Estilista',
    GERENTE: 'Gerente'
  };
  return map[role] ?? role.charAt(0) + role.slice(1).toLowerCase();
};

export default function AdminUserChip() {
  const [label, setLabel] = useState<{ name: string; role: string; initials: string } | null>(null);

  useEffect(() => {
    const token = getToken('staffToken');
    if (!token) {
      setLabel(null);
      return;
    }
    const payload = decodeJwt(token);
    if (!payload?.username) {
      setLabel(null);
      return;
    }
    const role = payload.roles?.[0];
    setLabel({
      name: payload.username,
      role: formatRole(role),
      initials: initialsOf(payload.username)
    });
  }, []);

  if (!label) return null;

  return (
    <div className="user-chip" aria-label={`Sesión activa: ${label.name}`}>
      <div className="user-avatar">{label.initials}</div>
      <div>
        <div className="user-name">{label.name}</div>
        <div className="user-role">{label.role}</div>
      </div>
    </div>
  );
}
