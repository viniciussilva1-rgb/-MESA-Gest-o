import { 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  User,
  createUserWithEmailAndPassword
} from "firebase/auth";
import { auth } from "./firebase";

export const loginWithEmail = async (email: string, password: string): Promise<User> => {
  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    return result.user;
  } catch (error: any) {
    console.error("Erro no login:", error);
    
    // Traduzir mensagens de erro
    if (error.code === 'auth/user-not-found') {
      throw new Error('Usuário não encontrado. Verifique o email.');
    } else if (error.code === 'auth/wrong-password') {
      throw new Error('Senha incorreta. Tente novamente.');
    } else if (error.code === 'auth/invalid-email') {
      throw new Error('Email inválido.');
    } else if (error.code === 'auth/too-many-requests') {
      throw new Error('Muitas tentativas. Aguarde alguns minutos.');
    } else if (error.code === 'auth/invalid-credential') {
      throw new Error('Credenciais inválidas. Verifique email e senha.');
    }
    
    throw new Error('Erro ao fazer login. Tente novamente.');
  }
};

export const logout = async (): Promise<void> => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Erro no logout:", error);
    throw error;
  }
};

export const subscribeToAuthState = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, callback);
};

// Função para criar usuário inicial (usar apenas uma vez)
export const createInitialUser = async (email: string, password: string): Promise<User> => {
  try {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    return result.user;
  } catch (error: any) {
    if (error.code === 'auth/email-already-in-use') {
      throw new Error('Este email já está cadastrado.');
    }
    throw error;
  }
};
