import React, { createContext, useContext, useState, useEffect } from 'react';
import { useUserSettings } from '../hooks/useUserSettings';

export type AccountType = 'TFSA' | 'FHSA' | 'NON_REGISTERED' | 'PERSONAL';

interface AccountContextType {
    selectedAccount: AccountType;
    switchAccount: (account: AccountType) => void;
    availableAccounts: AccountType[];
}

const AccountContext = createContext<AccountContextType>({
    selectedAccount: 'PERSONAL',
    switchAccount: () => { },
    availableAccounts: ['PERSONAL'],
});

// eslint-disable-next-line react-refresh/only-export-components
export const useAccount = () => useContext(AccountContext);

export const AccountProvider = ({ children }: { children: React.ReactNode }) => {
    const { settings, loading } = useUserSettings();
    const [selectedAccount, setSelectedAccount] = useState<AccountType>(() => {
        const saved = localStorage.getItem('selectedAccount');
        return (saved === 'TFSA' || saved === 'FHSA' || saved === 'NON_REGISTERED' || saved === 'PERSONAL') ? saved : 'PERSONAL';
    });

    // Map enabled accounts from settings (uses different naming convention)
    const availableAccounts: AccountType[] = settings.enabledAccounts.map(acc => {
        if (acc === 'NON-REGISTERED') return 'NON_REGISTERED';
        return acc as AccountType;
    });

    // Ensure selected account is in available accounts
    useEffect(() => {
        if (!loading && !availableAccounts.includes(selectedAccount)) {
            // If current selection is not available, switch to first available
            const newAccount = availableAccounts[0] || 'PERSONAL';
            setSelectedAccount(newAccount);
            localStorage.setItem('selectedAccount', newAccount);
        }
    }, [availableAccounts, selectedAccount, loading]);

    const switchAccount = (account: AccountType) => {
        if (availableAccounts.includes(account)) {
            setSelectedAccount(account);
            localStorage.setItem('selectedAccount', account);
        }
    };

    return (
        <AccountContext.Provider value={{ selectedAccount, switchAccount, availableAccounts }}>
            {children}
        </AccountContext.Provider>
    );
};
