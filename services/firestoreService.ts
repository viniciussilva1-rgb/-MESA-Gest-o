import { 
  collection, 
  doc, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  query,
  orderBy,
  onSnapshot,
  setDoc
} from "firebase/firestore";
import { db } from "./firebase";
import { Transaction, SystemConfig } from "../types";

const TRANSACTIONS_COLLECTION = "transactions";
const CONFIG_COLLECTION = "config";
const CONFIG_DOC_ID = "system_config";

// ============ TRANSACTIONS ============

export const subscribeToTransactions = (
  callback: (transactions: Transaction[]) => void,
  onError?: (error: Error) => void
) => {
  const q = query(collection(db, TRANSACTIONS_COLLECTION), orderBy("date", "desc"));
  
  return onSnapshot(q, (snapshot) => {
    const transactions: Transaction[] = [];
    snapshot.forEach((doc) => {
      transactions.push({ id: doc.id, ...doc.data() } as Transaction);
    });
    callback(transactions);
  }, (error) => {
    console.error("Erro ao ouvir transações:", error);
    // Chama callback com array vazio para não travar o loading
    callback([]);
    if (onError) onError(error);
  });
};

export const addTransaction = async (transaction: Transaction): Promise<void> => {
  console.log('=== FIRESTORE: Iniciando addTransaction ===');
  
  try {
    const { id, ...transactionData } = transaction;
    
    // Limpar campos undefined (Firestore não aceita)
    const cleanData: any = {
      date: transactionData.date,
      description: transactionData.description,
      amount: transactionData.amount,
      type: transactionData.type,
      category: transactionData.category,
      fundAllocations: transactionData.fundAllocations,
      createdAt: new Date().toISOString()
    };
    
    // Só adiciona campos opcionais se tiverem valor
    if (transactionData.invoiceRef) {
      cleanData.invoiceRef = transactionData.invoiceRef;
    }
    if (transactionData.hasAttachment) {
      cleanData.hasAttachment = transactionData.hasAttachment;
    }
    if (transactionData.cashCount) {
      cleanData.cashCount = transactionData.cashCount;
    }
    
    console.log('Dados limpos para enviar:', JSON.stringify(cleanData, null, 2));
    
    const docRef = await addDoc(collection(db, TRANSACTIONS_COLLECTION), cleanData);
    
    console.log('Transação salva com sucesso! ID:', docRef.id);
  } catch (error: any) {
    console.error('=== FIRESTORE: ERRO ao adicionar ===');
    console.error('Código:', error?.code);
    console.error('Mensagem:', error?.message);
    throw error;
  }
};

export const deleteTransaction = async (transactionId: string): Promise<void> => {
  try {
    await deleteDoc(doc(db, TRANSACTIONS_COLLECTION, transactionId));
  } catch (error) {
    console.error("Erro ao deletar transação:", error);
    throw error;
  }
};

// ============ CONFIG ============

export const subscribeToConfig = (callback: (config: SystemConfig | null) => void) => {
  return onSnapshot(doc(db, CONFIG_COLLECTION, CONFIG_DOC_ID), (snapshot) => {
    if (snapshot.exists()) {
      callback(snapshot.data() as SystemConfig);
    } else {
      callback(null);
    }
  }, (error) => {
    console.error("Erro ao ouvir configuração:", error);
  });
};

export const saveConfig = async (config: SystemConfig): Promise<void> => {
  try {
    await setDoc(doc(db, CONFIG_COLLECTION, CONFIG_DOC_ID), config);
  } catch (error) {
    console.error("Erro ao salvar configuração:", error);
    throw error;
  }
};

// ============ MIGRATION ============

export const migrateFromLocalStorage = async (): Promise<{ transactions: number; config: boolean }> => {
  let migratedTransactions = 0;
  let migratedConfig = false;

  try {
    // Migrar transações do localStorage
    const savedTransactions = localStorage.getItem('gestao_a_mesa_data');
    if (savedTransactions) {
      const transactions: Transaction[] = JSON.parse(savedTransactions);
      for (const tx of transactions) {
        const { id, ...txData } = tx;
        await addDoc(collection(db, TRANSACTIONS_COLLECTION), {
          ...txData,
          createdAt: new Date().toISOString()
        });
        migratedTransactions++;
      }
      // Limpar localStorage após migração bem-sucedida
      localStorage.removeItem('gestao_a_mesa_data');
    }

    // Migrar configurações do localStorage
    const savedConfig = localStorage.getItem('gestao_a_mesa_config');
    if (savedConfig) {
      const config: SystemConfig = JSON.parse(savedConfig);
      await saveConfig(config);
      migratedConfig = true;
      localStorage.removeItem('gestao_a_mesa_config');
    }
  } catch (error) {
    console.error("Erro durante migração:", error);
    throw error;
  }

  return { transactions: migratedTransactions, config: migratedConfig };
};
