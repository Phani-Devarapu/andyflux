import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../utils/firebase';
import { useAuth } from '../context/AuthContext';

export type AccountType = 'PERSONAL' | 'TFSA' | 'FHSA' | 'NON-REGISTERED';

interface UserSettings {
    enabledAccounts: AccountType[];
}

const DEFAULT_SETTINGS: UserSettings = {
    enabledAccounts: ['PERSONAL']
};

export function useUserSettings() {
    const { user } = useAuth();
    const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) {
            setSettings(DEFAULT_SETTINGS);
            setLoading(false);
            return;
        }

        const fetchSettings = async () => {
            try {
                const settingsRef = doc(db, 'users', user.uid, 'settings', 'preferences');
                const settingsSnap = await getDoc(settingsRef);

                if (settingsSnap.exists()) {
                    setSettings(settingsSnap.data() as UserSettings);
                } else {
                    // Create default settings for new user
                    await setDoc(settingsRef, DEFAULT_SETTINGS);
                    setSettings(DEFAULT_SETTINGS);
                }
            } catch (error) {
                console.error('Error fetching user settings:', error);
                setSettings(DEFAULT_SETTINGS);
            } finally {
                setLoading(false);
            }
        };

        fetchSettings();
    }, [user]);

    const updateEnabledAccounts = async (accounts: AccountType[]) => {
        if (!user) return;

        try {
            const settingsRef = doc(db, 'users', user.uid, 'settings', 'preferences');
            const newSettings = { ...settings, enabledAccounts: accounts };
            await setDoc(settingsRef, newSettings);
            setSettings(newSettings);
        } catch (error) {
            console.error('Error updating enabled accounts:', error);
            throw error;
        }
    };

    return {
        settings,
        loading,
        updateEnabledAccounts
    };
}
