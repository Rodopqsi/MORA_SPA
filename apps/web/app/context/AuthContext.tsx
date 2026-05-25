"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { clearToken, getToken, setToken } from '../lib/auth';

type AuthState = {
	clientToken: string | null;
	staffToken: string | null;
	isClientAuthed: boolean;
	isStaffAuthed: boolean;
	setClientToken: (token: string) => void;
	setStaffToken: (token: string) => void;
	clearClient: () => void;
	clearStaff: () => void;
	refresh: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
	const [clientToken, setClientTokenState] = useState<string | null>(null);
	const [staffToken, setStaffTokenState] = useState<string | null>(null);

	const refresh = useCallback(() => {
		setClientTokenState(getToken('clientToken'));
		setStaffTokenState(getToken('staffToken'));
	}, []);

	useEffect(() => {
		refresh();
		const handleStorage = () => refresh();
		window.addEventListener('storage', handleStorage);
		return () => window.removeEventListener('storage', handleStorage);
	}, [refresh]);

	const setClientToken = (token: string) => {
		setToken(token, 'clientToken');
		setClientTokenState(token);
	};

	const setStaffToken = (token: string) => {
		setToken(token, 'staffToken');
		setStaffTokenState(token);
	};

	const clearClient = () => {
		clearToken('clientToken');
		setClientTokenState(null);
	};

	const clearStaff = () => {
		clearToken('staffToken');
		setStaffTokenState(null);
	};

	const value = useMemo(
		() => ({
			clientToken,
			staffToken,
			isClientAuthed: Boolean(clientToken),
			isStaffAuthed: Boolean(staffToken),
			setClientToken,
			setStaffToken,
			clearClient,
			clearStaff,
			refresh
		}),
		[clientToken, staffToken]
	);

	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
	const context = useContext(AuthContext);
	if (!context) {
		throw new Error('useAuth must be used within AuthProvider');
	}
	return context;
}
