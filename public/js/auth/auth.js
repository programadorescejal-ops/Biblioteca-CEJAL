// ============================================
// SISTEMA DE AUTENTICAÇÃO
// Biblioteca CEJAL
// ============================================

class AuthSystem {
    constructor() {
        this.currentUser = null;
        this.userData = null;
        this.listeners = [];

        // Monitora estado da autenticação
        auth.onAuthStateChanged(async (user) => {
            if (user) {
                this.currentUser = user;
                await this.loadUserData(user.uid);
                this.notifyListeners('login', this.userData);
            } else {
                this.currentUser = null;
                this.userData = null;
                this.notifyListeners('logout', null);
            }
        });
    }

    // ============================================
    // LOGIN COM MATRÍCULA
    // ============================================
    async login(matricula, senha) {
        try {
            const email = `${matricula.trim()}@escola.com`;
            const userCredential = await auth.signInWithEmailAndPassword(email, senha);
            const user = userCredential.user;

            // Verifica se é admin
            const adminDoc = await db.collection('admins').doc(user.uid).get();
            if (adminDoc.exists) {
                this.userData = { ...adminDoc.data(), role: 'admin' };
                this.notifyListeners('admin-login', this.userData);
                return { success: true, role: 'admin', data: this.userData };
            }

            // Carrega dados do aluno
            await this.loadUserData(user.uid);
            return { success: true, role: 'aluno', data: this.userData };

        } catch (error) {
            console.error('Erro no login:', error);
            return {
                success: false,
                error: this.getErrorMessage(error.code)
            };
        }
    }

    // ============================================
    // CADASTRO DE ALUNO
    // ============================================
    async cadastrarAluno(dados) {
        const { nome, matricula, serie, turma, senha, confirmarSenha } = dados;

        // Validações
        if (senha !== confirmarSenha) {
            return { success: false, error: 'Senhas não coincidem' };
        }

        if (senha.length < 6) {
            return { success: false, error: 'Senha deve ter no mínimo 6 caracteres' };
        }

        try {
            // Verifica se matrícula já existe
            const existingAluno = await db.collection('alunos')
                .where('matricula', '==', matricula)
                .get();

            if (!existingAluno.empty) {
                return { success: false, error: 'Matrícula já cadastrada' };
            }

            // Usa app secundário para NÃO deslogar o admin atual
            const email = `${matricula}@escola.com`;
            let secondaryApp;
            try {
                secondaryApp = firebase.app('Secondary');
            } catch (e) {
                secondaryApp = firebase.initializeApp(firebase.app().options, 'Secondary');
            }
            const secondaryAuth = secondaryApp.auth();
            const userCredential = await secondaryAuth.createUserWithEmailAndPassword(email, senha);
            const user = userCredential.user;

            // Cria documento do aluno no Firestore
            const alunoData = {
                nome: nome.trim(),
                matricula: matricula,
                email: email,
                serie: serie,
                turma: turma,
                livros_atuais: [],
                historico: [],
                bloqueado: false,
                motivo_bloqueio: null,
                data_cadastro: serverTimestamp(),
                total_lidos: 0,
                badges: [],
                ultimo_acesso: serverTimestamp()
            };

            await db.collection('alunos').doc(user.uid).set(alunoData);

            // Desloga só a sessão secundária (admin continua logado)
            try { await secondaryAuth.signOut(); } catch (_) {}

            return {
                success: true,
                user: user,
                data: alunoData
            };

        } catch (error) {
            console.error('Erro no cadastro:', error);
            return {
                success: false,
                error: this.getErrorMessage(error.code)
            };
        }
    }

    // ============================================
    // LOGOUT
    // ============================================
    async logout() {
        try {
            await auth.signOut();
            return { success: true };
        } catch (error) {
            console.error('Erro no logout:', error);
            return { success: false, error: error.message };
        }
    }

    // ============================================
    // RECUPERAÇÃO DE SENHA
    // ============================================
    async resetPassword(matricula) {
        try {
            const email = `${matricula.trim()}@escola.com`;
            await auth.sendPasswordResetEmail(email);
            return {
                success: true,
                message: 'Email de recuperação enviado'
            };
        } catch (error) {
            return {
                success: false,
                error: this.getErrorMessage(error.code)
            };
        }
    }

    // ============================================
    // CARREGA DADOS DO USUÁRIO
    // ============================================
    async loadUserData(uid) {
        try {
            const doc = await db.collection('alunos').doc(uid).get();
            if (doc.exists) {
                this.userData = { id: uid, ...doc.data() };
                return this.userData;
            }
            throw new Error('Usuário não encontrado');
        } catch (error) {
            console.error('Erro ao carregar dados do usuário:', error);
            throw error;
        }
    }

    // ============================================
    // SISTEMA DE LISTENERS
    // ============================================
    addListener(callback) {
        this.listeners.push(callback);
        return () => {
            this.listeners = this.listeners.filter(cb => cb !== callback);
        };
    }

    notifyListeners(event, data) {
        this.listeners.forEach(callback => {
            try {
                callback(event, data);
            } catch (error) {
                console.error('Erro no listener:', error);
            }
        });
    }

    // ============================================
    // TRADUÇÃO DE ERROS
    // ============================================
    getErrorMessage(code) {
        const errors = {
            'auth/user-not-found': 'Usuário não encontrado',
            'auth/wrong-password': 'Senha incorreta',
            'auth/email-already-in-use': 'Email já cadastrado',
            'auth/invalid-email': 'Email inválido',
            'auth/weak-password': 'Senha muito fraca',
            'auth/too-many-requests': 'Muitas tentativas, tente depois',
            'auth/user-disabled': 'Usuário desativado',
            'auth/network-request-failed': 'Erro de conexão com a internet'
        };
        return errors[code] || 'Erro desconhecido';
    }
}

// ============================================
// INSTÂNCIA GLOBAL
// ============================================
const authSystem = new AuthSystem();
window.authSystem = authSystem;