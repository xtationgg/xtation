export type UserLedger = {
  xp: number;
  days: Record<string, any>;
  meta?: {
    lastSync?: string;
  };
};

export type UserLedgerRecord = {
  ledger: UserLedger;
  clientUpdatedAt: string | null;
  updatedAt: string | null;
  isNew: boolean;
};
