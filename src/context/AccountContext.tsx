import React, { createContext, useContext, useState } from 'react';

export type AccountType = 'TFSA' | 'FHSA' | 'NON_REGISTERED' | 'PERSONAL';

interface AccountContextType {
    selectedAccount: AccountType;
    switchAccount: (account: AccountType) => void;
}

const AccountContext = createContext<AccountContextType>({
    selectedAccount: 'TFSA',
    switchAccount: () => { },
});

// eslint-disable-next-line react-refresh/only-export-components
export const useAccount = () => useContext(AccountContext);

export const AccountProvider = ({ children }: { children: React.ReactNode }) => {
    const [selectedAccount, setSelectedAccount] = useState<AccountType>(() => {
        const saved = localStorage.getItem('selectedAccount');
        return (saved === 'TFSA' || saved === 'FHSA' || saved === 'NON_REGISTERED') ? saved : 'TFSA';
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
