"use client";

import { useRouter } from 'next/navigation';
import { useAuth } from '../context/AuthContext';

export default function AdminLogoutButton() {
  const router = useRouter();
  const { clearStaff } = useAuth();

  const handleLogout = () => {
    clearStaff();
    router.replace('/admin/login');
    router.refresh();
  };

  return (
    <button className="btn btn-outline" type="button" onClick={handleLogout}>
      Cerrar sesion
    </button>
  );
}