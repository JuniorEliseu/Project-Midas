import CryptoJS from 'crypto-js';
import type { BackupPayload } from '@/types';
import { db } from './db';

export async function createBackupPayload(): Promise<BackupPayload> {
  const [accounts, transactions, goals, investments, defiPools] = await Promise.all([
    db.accounts.toArray(),
    db.transactions.toArray(),
    db.goals.toArray(),
    db.investments.toArray(),
    db.defiPools.toArray()
  ]);

  return {
    version: '1.0.0',
    createdAt: new Date().toISOString(),
    accounts,
    transactions,
    goals,
    investments,
    defiPools
  };
}

export function encryptPayload(data: BackupPayload, pass: string): string {
  if (!pass) throw new Error('Senha necessária para criptografia AES-256.');
  const jsonString = JSON.stringify(data);
  const encrypted = CryptoJS.AES.encrypt(jsonString, pass).toString();
  return JSON.stringify({ encryptedData: encrypted, algo: 'AES-256', isEncrypted: true });
}

export function decryptPayload(rawContent: string, pass: string): BackupPayload {
  try {
    const parsed = JSON.parse(rawContent);
    if (parsed.isEncrypted && parsed.encryptedData) {
      if (!pass) {
        throw new Error('Este arquivo está criptografado. Digite a chave de segurança (AES-256) para restaurar.');
      }
      const bytes = CryptoJS.AES.decrypt(parsed.encryptedData, pass);
      const decryptedString = bytes.toString(CryptoJS.enc.Utf8);
      if (!decryptedString) {
        throw new Error('Senha incorreta ou arquivo de backup corrompido.');
      }
      return JSON.parse(decryptedString) as BackupPayload;
    } else {
      // Se não for criptografado
      return parsed as BackupPayload;
    }
  } catch (err: unknown) {
    if (err instanceof Error) {
      throw new Error(err.message || 'Falha ao processar arquivo de restauração.');
    }
    throw new Error('Falha desconhecida ao processar arquivo.');
  }
}

export function downloadBackupFile(data: string, encrypted: boolean): void {
  const dateStr = new Date().toISOString().split('T')[0];
  const filename = encrypted ? `midas-encrypted-${dateStr}.json` : `midas-backup-${dateStr}.json`;
  
  const blob = new Blob([data], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  
  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 100);
}

export async function restoreDatabaseFromPayload(payload: BackupPayload): Promise<void> {
  if (!payload || !payload.accounts) {
    throw new Error('Estrutura de arquivo de backup inválida ou incompleta.');
  }

  await db.transaction('rw', db.accounts, db.transactions, db.goals, db.investments, db.defiPools, async () => {
    await db.accounts.clear();
    await db.transactions.clear();
    await db.goals.clear();
    await db.investments.clear();
    await db.defiPools.clear();

    if (payload.accounts.length > 0) await db.accounts.bulkAdd(payload.accounts);
    if (payload.transactions.length > 0) await db.transactions.bulkAdd(payload.transactions);
    if (payload.goals.length > 0) await db.goals.bulkAdd(payload.goals);
    if (payload.investments.length > 0) await db.investments.bulkAdd(payload.investments);
    if (payload.defiPools.length > 0) await db.defiPools.bulkAdd(payload.defiPools);
  });
}
