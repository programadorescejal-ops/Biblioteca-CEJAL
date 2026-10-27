// ============================================
// SISTEMA ADMINISTRATIVO
// Biblioteca CEJAL
// ============================================

class AdminSystem {
    constructor() {
        this.adminData = null;
    }

    // ============================================
    // VERIFICAR SE É ADMIN
    // ============================================
    async isAdmin(uid) {
        try {
            const doc = await db.collection('admins').doc(uid).get();
            return doc.exists;
        } catch (error) {
            console.error('Erro ao verificar admin:', error);
            return false;
        }
    }

    // ============================================
    // OBTER DADOS DO ADMIN
    // ============================================
    async getAdminData(uid) {
        try {
            const doc = await db.collection('admins').doc(uid).get();
            if (doc.exists) {
                this.adminData = { id: uid, ...doc.data() };
                return this.adminData;
            }
            return null;
        } catch (error) {
            console.error('Erro ao obter dados do admin:', error);
            return null;
        }
    }

    // ============================================
    // CRIAR ADMIN (PRIMEIRO ACESSO)
    // ============================================
    async createAdmin(uid, nome, email) {
        try {
            const adminData = {
                nome: nome,
                email: email,
                role: 'admin',
                data_criacao: serverTimestamp()
            };

            await db.collection('admins').doc(uid).set(adminData);
            return { success: true, data: adminData };

        } catch (error) {
            console.error('Erro ao criar admin:', error);
            return { success: false, error: error.message };
        }
    }

    // ============================================
    // LISTAR TODOS OS ALUNOS
    // ============================================
    async listarAlunos() {
        try {
            const snapshot = await db.collection('alunos')
                .orderBy('nome')
                .get();

            const alunos = [];
            snapshot.forEach((doc) => {
                alunos.push({
                    id: doc.id,
                    ...doc.data()
                });
            });

            return alunos;

        } catch (error) {
            console.error('Erro ao listar alunos:', error);
            return [];
        }
    }

    // ============================================
    // LISTAR ALUNOS BLOQUEADOS
    // ============================================
    async listarAlunosBloqueados() {
        try {
            const snapshot = await db.collection('alunos')
                .where('bloqueado', '==', true)
                .get();

            const alunos = [];
            snapshot.forEach((doc) => {
                alunos.push({
                    id: doc.id,
                    ...doc.data()
                });
            });

            return alunos;

        } catch (error) {
            console.error('Erro ao listar alunos bloqueados:', error);
            return [];
        }
    }

    // ============================================
    // BLOQUEAR ALUNO
    // ============================================
    async bloquearAluno(alunoId, motivo) {
        try {
            await db.collection('alunos').doc(alunoId).update({
                bloqueado: true,
                motivo_bloqueio: motivo
            });

            return { success: true };

        } catch (error) {
            console.error('Erro ao bloquear aluno:', error);
            return { success: false, error: error.message };
        }
    }

    // ============================================
    // DESBLOQUEAR ALUNO
    // ============================================
    async desbloquearAluno(alunoId) {
        try {
            await db.collection('alunos').doc(alunoId).update({
                bloqueado: false,
                motivo_bloqueio: null
            });

            return { success: true };

        } catch (error) {
            console.error('Erro ao desbloquear aluno:', error);
            return { success: false, error: error.message };
        }
    }

    // ============================================
    // ESTATÍSTICAS DO SISTEMA
    // ============================================
    async getEstatisticas() {
        try {
            const stats = {};

            // Total de livros
            const livrosSnapshot = await db.collection('livros').get();
            stats.totalLivros = livrosSnapshot.size;

            // Livros disponíveis
            const disponiveisSnapshot = await db.collection('livros')
                .where('quantidade_disponivel', '>', 0)
                .get();
            stats.livrosDisponiveis = disponiveisSnapshot.size;

            // Total de alunos
            const alunosSnapshot = await db.collection('alunos').get();
            stats.totalAlunos = alunosSnapshot.size;

            // Empréstimos ativos
            const emprestimosSnapshot = await db.collection('emprestimos')
                .where('status', '==', 'ativo')
                .get();
            stats.emprestimosAtivos = emprestimosSnapshot.size;

            // Alunos bloqueados
            const bloqueadosSnapshot = await db.collection('alunos')
                .where('bloqueado', '==', true)
                .get();
            stats.alunosBloqueados = bloqueadosSnapshot.size;

            // Empréstimos atrasados
            const atrasados = await livrosSystem.verificarAtrasos();
            stats.emprestimosAtrasados = atrasados.length;

            return stats;

        } catch (error) {
            console.error('Erro ao obter estatísticas:', error);
            return null;
        }
    }

    // ============================================
    // TOP LIVROS MAIS EMPRESTADOS
    // ============================================
    async getTopLivros(limit = 5) {
        try {
            const snapshot = await db.collection('livros')
                .orderBy('total_emprestimos', 'desc')
                .limit(limit)
                .get();

            const livros = [];
            snapshot.forEach((doc) => {
                livros.push({
                    id: doc.id,
                    ...doc.data()
                });
            });

            return livros;

        } catch (error) {
            console.error('Erro ao obter top livros:', error);
            return [];
        }
    }

    // ============================================
    // TOP ALUNOS LEITORES
    // ============================================
    async getTopAlunos(limit = 5) {
        try {
            const snapshot = await db.collection('alunos')
                .orderBy('total_lidos', 'desc')
                .limit(limit)
                .get();

            const alunos = [];
            snapshot.forEach((doc) => {
                alunos.push({
                    id: doc.id,
                    ...doc.data()
                });
            });

            return alunos;

        } catch (error) {
            console.error('Erro ao obter top alunos:', error);
            return [];
        }
    }
}

// ============================================
// INSTÂNCIA GLOBAL
// ============================================
const adminSystem = new AdminSystem();
window.adminSystem = adminSystem;