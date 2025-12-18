import React, { createContext, useContext, useState } from 'react';

type AccountType = 'trading' | 'investing';

interface AccountContextType {
    selectedAccount: AccountType;
    switchAccount: (account: AccountType) => void;
}

const AccountContext = createContext<AccountContextType>({
    selectedAccount: 'trading',
    switchAccount: () => { },
});

// eslint-disable-next-line react-refresh/only-export-components
export const useAccount = () => useContext(AccountContext);

export const AccountProvider = ({ children }: { children: React.ReactNode }) => {
    const [selectedAccount, setSelectedAccount] = useState<AccountType>(() => {
        const saved = localStorage.getItem('selectedAccount');
        return (saved === 'trading' || saved === 'investing') ? saved : 'trading';
    });

    const switchAccount = (account: AccountType) => {
        setSelectedAccount(account);
        localStorage.setItem('selectedAccount', account);
    };

    return (
        <AccountContext.Provider value={{ selectedAccount, switchAccount }}>
            {children}
        </AccountContext.Provider>
    );
};
