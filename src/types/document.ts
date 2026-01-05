export interface StoredDocument {
    id?: string;
    userId: string;
    accountId: string;
    name: string;
    type: string;
    size: number;
    storagePath: string; // Path in Firebase Storage
    createdAt: Date;
    content?: Blob; // Optional, mainly for immediate upload
    synced?: boolean; // True if confirmed uploaded to Firebase Storage
}
