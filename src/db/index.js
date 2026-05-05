export { calcolaScadenza, getDb, initDatabase } from './baraiDb.js';
export { getDashboardData } from './repositories/dashboardRepo.js';
export { getScadenze, getScadenziarioData, aggiornaStatoScadenza, aggiornaStatoScadenze, segnaScadenzaPagata, segnaScadenzePagate, riapriScadenza } from './repositories/scadenziarioRepo.js';
export { saveFornitore } from './repositories/fornitoriRepo.js';
export { saveRegolaPagamento } from './repositories/regolePagamentoRepo.js';
export { saveFatturaAcquisto, importFatturaAcquistoXml, importFatturaVenditaXml } from './repositories/fattureRepo.js';
export { getPrimaNotaData, getPrimaNotaConfigData, savePrimaNotaConfig, savePrimaNotaMovimento, deletePrimaNotaMovimento, rigeneraPrimaNotaDaPagamenti } from './repositories/primaNotaRepo.js';
export { getControlloPrezziData, saveProdottoMapping, saveProdottoAnagrafica } from './repositories/controlloPrezziRepo.js';
export { getFoodCostData, saveRicettaFoodCost, deleteRicettaFoodCost } from './repositories/foodCostRepo.js';
export { getSyncBackupData, saveSyncConfig, generateSyncSnapshot, applySyncSnapshot, checkCloudSyncStatus, pushSyncSnapshotToCloud, pushSyncSnapshotToCloudAndExplode, explodeCloudSnapshotToSheets, pullSyncSnapshotFromCloud, getPushSafetyStatus, forcePushSyncSnapshotToCloudAndExplode, pullThenPushSyncSnapshotToCloudAndExplode } from './repositories/syncRepo.js';
export { listLocalDbBackups, createLocalDbBackup, createAutomaticStartupBackupIfNeeded, openLocalBackupFolder, runDatabaseDiagnostics } from './repositories/backupRepo.js';

export { getGestioneData, saveIncassoCassa, importIncassiCassa, deleteIncassoCassa, saveBustaPaga, importBustePagaJson, deleteBustaPaga, saveVersamentoF24, importF24Json, deleteVersamentoF24 } from './repositories/gestioneRepo.js';
