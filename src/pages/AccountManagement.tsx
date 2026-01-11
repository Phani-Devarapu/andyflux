import { useState } from 'react';
import {
    Box,
    Typography,
    Paper,
    FormGroup,
    FormControlLabel,
    Checkbox,
    Button,
    Alert,
    Divider,
    Stack
} from '@mui/material';
import { useUserSettings, type AccountType } from '../hooks/useUserSettings';
import { DataManagementDialog } from '../components/settings/DataManagementDialog';

const ACCOUNT_TYPES: { value: AccountType; label: string; description: string }[] = [
    { value: 'PERSONAL', label: 'Personal', description: 'Personal expenses and budgeting' },
    { value: 'TFSA', label: 'TFSA', description: 'Tax-Free Savings Account' },
    { value: 'FHSA', label: 'FHSA', description: 'First Home Savings Account' },
    { value: 'NON-REGISTERED', label: 'Non-Registered', description: 'Non-registered trading account' },
];

export function AccountManagement() {
    const { settings, loading, updateEnabledAccounts } = useUserSettings();
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [dataDialogOpen, setDataDialogOpen] = useState(false);

    const handleToggleAccount = async (accountType: AccountType) => {
        try {
            setError(null);
            setSaving(true);

            const currentEnabled = settings.enabledAccounts;
            let newEnabled: AccountType[];

            if (currentEnabled.includes(accountType)) {
                // Prevent disabling if it's the only account
                if (currentEnabled.length === 1) {
                    setError('You must have at least one account enabled');
                    setSaving(false);
                    return;
                }
                newEnabled = currentEnabled.filter(a => a !== accountType);
            } else {
                newEnabled = [...currentEnabled, accountType];
            }

            await updateEnabledAccounts(newEnabled);
            setSuccess(true);
            setTimeout(() => setSuccess(false), 3000);
        } catch (err) {
            setError('Failed to update account settings');
            console.error(err);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <Box sx={{ p: 4 }}>
                <Typography>Loading...</Typography>
            </Box>
        );
    }

    return (
        <Box sx={{ p: 4, maxWidth: 800, mx: 'auto' }}>
            <Typography variant="h4" fontWeight="bold" gutterBottom>
                Account Management
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
                Manage your account types and data settings
            </Typography>

            {/* Account Types Section */}
            <Paper sx={{ p: 3, mb: 3, borderRadius: 3 }}>
                <Typography variant="h6" fontWeight="bold" gutterBottom>
                    Enabled Account Types
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                    Select which account types you want to use. Only enabled accounts will appear in the account dropdown.
                </Typography>

                {error && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                        {error}
                    </Alert>
                )}

                {success && (
                    <Alert severity="success" sx={{ mb: 2 }}>
                        Account settings updated successfully!
                    </Alert>
                )}

                <FormGroup>
                    {ACCOUNT_TYPES.map((account) => (
                        <FormControlLabel
                            key={account.value}
                            control={
                                <Checkbox
                                    checked={settings.enabledAccounts.includes(account.value)}
                                    onChange={() => handleToggleAccount(account.value)}
                                    disabled={saving}
                                />
                            }
                            label={
                                <Box>
                                    <Typography variant="body1" fontWeight={500}>
                                        {account.label}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        {account.description}
                                    </Typography>
                                </Box>
                            }
                            sx={{ mb: 2, alignItems: 'flex-start' }}
                        />
                    ))}
                </FormGroup>
            </Paper>

            <Divider sx={{ my: 3 }} />

            {/* Data Management Section */}
            <Paper sx={{ p: 3, borderRadius: 3 }}>
                <Typography variant="h6" fontWeight="bold" gutterBottom>
                    Data Management
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                    Manage your trading data and application settings
                </Typography>

                <Stack spacing={2}>
                    <Button
                        variant="outlined"
                        color="error"
                        onClick={() => setDataDialogOpen(true)}
                        sx={{ alignSelf: 'flex-start' }}
                    >
                        Delete All Data
                    </Button>
                </Stack>
            </Paper>

            {/* Data Management Dialog */}
            <DataManagementDialog
                open={dataDialogOpen}
                onClose={() => setDataDialogOpen(false)}
            />
        </Box>
    );
}
