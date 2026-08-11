import React, { useState } from 'react';
import { db, seedDatabase } from '@/services/db';
import { useAppStore } from '@/store/useAppStore';
import { createBackupPayload, encryptPayload, decryptPayload, downloadBackupFile, restoreDatabaseFromPayload } from '@/services/crypto';
import { formatDate } from '@/utils/formatters';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { ShieldCheck, Download, Upload, RefreshCw, Trash2, Database, Key, Sparkles, AlertTriangle } from 'lucide-react';

export const SettingsView: React.FC = () => {
  const { quotesUpdated, quotesSource, isOffline, refreshRates, theme, toggleTheme } = useAppStore();

  // Estados do Export
  const [useEncryption, setUseEncryption] = useState(false);
  const [exportPassword, setExportPassword] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  // Estados do Import / Restauração
  const [importPassword, setImportPassword] = useState('');
  const [importError, setImportError] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const payload = await createBackupPayload();
      let fileData: string;

      if (useEncryption) {
        if (!exportPassword) {
          alert('Por favor, defina uma senha secreta para criptografar o backup com AES-256.');
          setIsExporting(false);
          return;
        }
        fileData = encryptPayload(payload, exportPassword);
      } else {
        fileData = JSON.stringify(payload, null, 2);
      }

      downloadBackupFile(fileData, useEncryption);
      alert('Backup gerado e baixado para o seu computador com sucesso!');
    } catch (error: any) {
      alert(`Falha ao exportar backup: ${error.message || 'Erro desconhecido'}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setImportError('');
    try {
      const text = await file.text();
      const payload = decryptPayload(text, importPassword);
      
      await restoreDatabaseFromPayload(payload);
      alert('Banco de dados IndexedDB restaurado com sucesso a partir do backup! A interface será atualizada.');
      window.location.reload();
    } catch (err: any) {
      setImportError(err.message || 'Falha na leitura ou descriptografia do arquivo. Verifique a senha AES-256.');
      e.target.value = ''; // Reset input file
    } finally {
      setIsImporting(false);
    }
  };

  const handleSeedDemo = async () => {
    if (window.confirm('Atenção: Ao carregar os dados de demonstração (Seed Demo), seu histórico local atual no IndexedDB será substituído pela carteira simulada oficial do projeto acadêmico. Deseja prosseguir?')) {
      await seedDatabase();
      alert('Dados de demonstração acadêmica carregados com sucesso!');
      window.location.reload();
    }
  };

  const handleClearDatabase = async () => {
    if (window.confirm('PERIGO: Esta ação apagará todas as contas, transações, caixinhas e investimentos do banco local IndexedDB do navegador. Confirmar exclusão geral?')) {
      await db.transaction('rw', [db.accounts, db.transactions, db.goals, db.investments, db.defiPools], async () => {
        await db.accounts.clear();
        await db.transactions.clear();
        await db.goals.clear();
        await db.investments.clear();
        await db.defiPools.clear();
      });
      alert('Banco de dados local esvaziado.');
      window.location.reload();
    }
  };

  return (
    <div className="space-y-8 pb-12 animate-in fade-in duration-300 max-w-5xl mx-auto">
      {/* Cabeçalho */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <ShieldCheck className="w-7 h-7 text-emerald-500" />
          Segurança, Criptografia & Controle Local
        </h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Gerencie o banco de dados IndexedDB de forma 100% offline, gere backups com criptografia militar e configure caches.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* CARTÃO 1: EXPORTAR BACKUP COM AES-256 */}
        <Card title={
          <span className="flex items-center gap-2 text-base font-bold text-gray-900 dark:text-white">
            <Download className="w-5 h-5 text-blue-500" /> Exportação & Backup Seguro
          </span>
        } subtitle="Gere um arquivo .json com todos os seus dados do IndexedDB" className="flex flex-col justify-between border-t-4 border-t-blue-500">
          <div className="space-y-4">
            <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
              O arquivo gerado armazena todo o histórico patrimonial no seu computador. Para máxima segurança contra acessos não autorizados, ative a criptografia <strong>AES-256 client-side</strong>.
            </p>

            <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-gray-900/60 border border-gray-200/70 dark:border-gray-800 space-y-3">
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={useEncryption}
                  onChange={(e) => setUseEncryption(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800"
                />
                <span className="text-sm font-bold text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                  <Key className="w-4 h-4 text-amber-500" /> Proteger com Criptografia (AES-256)
                </span>
              </label>

              {useEncryption && (
                <Input
                  label="Chave de Criptografia (Senha Secreta)"
                  type="password"
                  placeholder="Digite uma senha forte..."
                  value={exportPassword}
                  onChange={(e) => setExportPassword(e.target.value)}
                  helperText="Guarde esta chave. Sem ela, será impossível descriptografar este arquivo no futuro."
                />
              )}
            </div>
          </div>

          <Button
            variant="primary"
            onClick={handleExport}
            isLoading={isExporting}
            leftIcon={<Download className="w-4 h-4" />}
            className="mt-6 w-full font-bold py-3"
          >
            {useEncryption ? 'Exportar Backup Criptografado (AES-256)' : 'Exportar Backup JSON (Sem Criptografia)'}
          </Button>
        </Card>

        {/* CARTÃO 2: IMPORTAR / RESTAURAR BACKUP */}
        <Card title={
          <span className="flex items-center gap-2 text-base font-bold text-gray-900 dark:text-white">
            <Upload className="w-5 h-5 text-emerald-500" /> Restauração de Dados
          </span>
        } subtitle="Faça upload de um arquivo de backup para restaurar o banco" className="flex flex-col justify-between border-t-4 border-t-emerald-500">
          <div className="space-y-4">
            <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
              Ao importar um arquivo, os dados atuais no IndexedDB serão atualizados. Se o backup estiver protegido por <strong>AES-256</strong>, digite a senha antes de selecionar o arquivo.
            </p>

            <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-gray-900/60 border border-gray-200/70 dark:border-gray-800 space-y-3">
              <Input
                label="Senha AES-256 (Se o arquivo for criptografado)"
                type="password"
                placeholder="Deixe em branco se for arquivo normal..."
                value={importPassword}
                onChange={(e) => setImportPassword(e.target.value)}
              />
            </div>

            {importError && (
              <div className="p-3 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-400 text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{importError}</span>
              </div>
            )}
          </div>

          <div className="mt-6">
            <label className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold px-4 py-3 rounded-xl cursor-pointer shadow-md shadow-emerald-500/20 transition-all text-sm">
              <Upload className="w-4 h-4" />
              <span>{isImporting ? 'Descriptografando e Restaurando...' : 'Selecionar Arquivo Backup e Restaurar'}</span>
              <input
                type="file"
                accept=".json,.midas-encrypted"
                onChange={handleFileChange}
                disabled={isImporting}
                className="hidden"
              />
            </label>
          </div>
        </Card>
      </div>

      {/* CARTÃO 3: CONTROLE DE CACHE OFFLINE-FIRST E TEMAS */}
      <Card title={
        <span className="flex items-center gap-2 text-base font-bold text-gray-900 dark:text-white">
          <Database className="w-5 h-5 text-purple-500" /> Estado do Motor Local & Cotações Offline
        </span>
      } subtitle="Parâmetros de sincronização das APIs gratuitas (AwesomeAPI & CoinGecko)">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 py-2">
          <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-900/50 border border-gray-200/60 dark:border-gray-800">
            <span className="text-[11px] text-gray-400 uppercase font-semibold">Modo da Conexão</span>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant={isOffline ? 'warning' : 'success'}>
                {isOffline ? 'Modo Offline (IndexedDB Cache)' : 'Online (APIs Ao Vivo)'}
              </Badge>
            </div>
            <p className="text-[10px] text-gray-400 mt-2">Fonte: {quotesSource}</p>
          </div>

          <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-900/50 border border-gray-200/60 dark:border-gray-800">
            <span className="text-[11px] text-gray-400 uppercase font-semibold">Última Sincronização</span>
            <p className="text-sm font-bold text-gray-800 dark:text-gray-200 mt-1">
              {new Date(quotesUpdated).toLocaleTimeString('pt-BR')} ({formatDate(new Date(quotesUpdated).toISOString())})
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => refreshRates()}
              leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
              className="mt-2 text-xs w-full"
            >
              Forçar Sincronização Agora
            </Button>
          </div>

          <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-900/50 border border-gray-200/60 dark:border-gray-800">
            <span className="text-[11px] text-gray-400 uppercase font-semibold">Aparência do Sistema</span>
            <p className="text-sm font-bold text-gray-800 dark:text-gray-200 mt-1">
              {theme === 'dark' ? '🌙 Modo Escuro Premium (Ativo)' : '☀️ Modo Claro (Ativo)'}
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={toggleTheme}
              className="mt-2 text-xs w-full"
            >
              Alternar Tema Agora
            </Button>
          </div>
        </div>
      </Card>

      {/* CARTÃO 4: SIMULADO ACADÊMICO E RESET DE DADOS */}
      <Card 
        glow 
        className="bg-gradient-to-r from-amber-500/10 via-yellow-500/5 to-transparent border-amber-500/30"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="space-y-1 max-w-xl">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-500 animate-pulse" />
              <h3 className="text-base font-bold text-gray-900 dark:text-white">
                Controle do Simulado Acadêmico (Midas Wb)
              </h3>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
              O botão de <strong>Demonstração</strong> repopula instantaneamente o banco de dados IndexedDB com uma carteira fictícia realista (bancos, bolsa de valores, transações recém-geradas e posições em pools DeFi) para facilitar avaliações da banca acadêmica.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              variant="gold"
              onClick={handleSeedDemo}
              leftIcon={<Sparkles className="w-4 h-4 text-gray-950" />}
              className="font-extrabold whitespace-nowrap px-6 py-3"
            >
              Carregar Dados de Demonstração (Seed Demo)
            </Button>
            
            <Button
              variant="danger"
              onClick={handleClearDatabase}
              leftIcon={<Trash2 className="w-4 h-4" />}
              className="whitespace-nowrap px-4 py-3"
              title="Apagar todo o banco IndexedDB"
            >
              Limpar DB
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};
