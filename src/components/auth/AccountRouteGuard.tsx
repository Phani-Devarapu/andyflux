import { Navigate } from 'react-router-dom';
import { useAccount } from '../../context/AccountContext';

interface AccountRouteGuardProps {
    children: React.ReactNode;
    allowedAccounts?: ('TFSA' | 'FHSA' | 'NON_REGISTERED' | 'PERSONAL')[];
}

/**
 * Route guard that restricts access based on selected account type
 * Redirects to dashboard if current account is not in allowedAccounts
 */
export function AccountRouteGuard({ children, allowedAccounts }: AccountRouteGuardProps) {
    const { selectedAccount } = useAccount();

    // If no restrictions specified, allow access
    if (!allowedAccounts || allowedAccounts.length === 0) {
        return <>{children}</>;
    }

    // Check if current account is allowed
    if (!allowedAccounts.includes(selectedAccount)) {
        return <Navigate to="/" replace />;
    }

    return <>{children}</>;
}
