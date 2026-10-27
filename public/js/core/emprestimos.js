// ============================================
// SISTEMA DE EMPRÉSTIMOS
// Biblioteca CEJAL
// ============================================

class EmprestimosSystem {
    constructor() {
        this.emprestimos = [];
        this.listeners = [];
        this.unsubscribe = null;
    }

    // ============================================
    // LISTAR EMPRÉSTIMOS EM TEMPO REAL
    // ============================================
    listarEmprestimosEmTempoReal(alunoId = null, callback = null) {
        if (this.unsubscribe) {
            this.unsubscribe();
        }

        let query = db.collection('emprestimos')
            .orderBy('data_emprestimo', 'desc');

        if (alunoId) {
            query = query.where('aluno_id', '==', alunoId);
        }

        this.unsubscribe = query.onSnapshot((snapshot) => {
            const emprestimos = [];
            snapshot.forEach((doc) => {
                emprestimos.push({
                    id: doc.id,
                    ...doc.data()
                });
            });

            this.emprestimos = emprestimos;
            this.notifyListeners(emprestimos);

            if (callback) callback(emprestimos);

        }, (error) => {
            console.error('Erro ao listar empréstimos:', error);
        });

        return this.unsubscribe;
    }

    // ============================================
    // LISTAR EMPRÉSTIMOS ATIVOS DE UM ALUNO
    // ============================================
    async listarEmprestimosAtivos(alunoId) {
        try {
            const snapshot = await db.collection('emprestimos')
                .where('aluno_id', '==', alunoId)
                .where('status', '==', 'ativo')
                .get();

            const emprestimos = [];
            snapshot.forEach((doc) => {
                emprestimos.push({
                    id: doc.id,
                    ...doc.data()
                });
            });

            return emprestimos;

        } catch (error) {
            console.error('Erro ao listar empréstimos ativos:', error);
            return [];
        }
    }

    // ============================================
    // LISTAR HISTÓRICO DE EMPRÉSTIMOS DE UM ALUNO
    // ============================================
    async listarHistorico(alunoId) {
        try {
            const snapshot = await db.collection('emprestimos')
                .where('aluno_id', '==', alunoId)
                .where('status', '==', 'devolvido')
                .orderBy('data_devolucao_real', 'desc')
                .get();

            const emprestimos = [];
            snapshot.forEach((doc) => {
                emprestimos.push({
                    id: doc.id,
                    ...doc.data()
                });
            });

            return emprestimos;

        } catch (error) {
            console.error('Erro ao listar histórico:', error);
            return [];
        }
    }

    // ============================================
    // RENOVAR EMPRÉSTIMO
    // ============================================
    async renovarEmprestimo(emprestimoId) {
        try {
            const emprestimoRef = db.collection('emprestimos').doc(emprestimoId);
            const emprestimoDoc = await emprestimoRef.get();

            if (!emprestimoDoc.exists) {
                return { success: false, error: 'Empréstimo não encontrado' };
            }

            const emprestimo = emprestimoDoc.data();

            if (emprestimo.status !== 'ativo') {
                return { success: false, error: 'Este empréstimo não está ativo' };
            }

            // Verifica se já foi renovado
            if (emprestimo.renovado) {
                return { success: false, error: 'Este empréstimo já foi renovado' };
            }

            // Nova data de devolução (+7 dias)
            const rawDev = emprestimo.data_devolucao_prevista;
            const baseDate = rawDev && rawDev.toDate ? rawDev.toDate() : new Date(rawDev);
            const novaDataDevolucao = new Date(baseDate);
            novaDataDevolucao.setDate(novaDataDevolucao.getDate() + 7);

            await emprestimoRef.update({
                data_devolucao_prevista: novaDataDevolucao,
                renovado: true
            });

            return {
                success: true,
                novaDataDevolucao: novaDataDevolucao
            };

        } catch (error) {
            console.error('Erro ao renovar empréstimo:', error);
            return { success: false, error: error.message };
        }
    }

    // ============================================
    // CONTAR EMPRÉSTIMOS ATIVOS DE UM ALUNO
    // ============================================
    async contarEmprestimosAtivos(alunoId) {
        try {
            const snapshot = await db.collection('emprestimos')
                .where('aluno_id', '==', alunoId)
                .where('status', '==', 'ativo')
                .get();

            return snapshot.size;

        } catch (error) {
            console.error('Erro ao contar empréstimos:', error);
            return 0;
        }
    }

    // ============================================
    // VERIFICAR SE ALUNO TEM ATRASO
    // ============================================
    async verificarAtrasoAluno(alunoId) {
        try {
            const atrasados = await livrosSystem.verificarAtrasos();
            return atrasados.filter(a => a.aluno_id === alunoId);

        } catch (error) {
            console.error('Erro ao verificar atraso:', error);
            return [];
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

    notifyListeners(emprestimos) {
        this.listeners.forEach(callback => {
            try {
                callback(emprestimos);
            } catch (error) {
                console.error('Erro no listener:', error);
            }
        });
    }
}

// ============================================
// INSTÂNCIA GLOBAL
// ============================================
const emprestimosSystem = new EmprestimosSystem();
window.emprestimosSystem = emprestimosSystem;