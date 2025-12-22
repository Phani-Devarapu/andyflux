export interface StoredDocument {
    id?: number;
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
