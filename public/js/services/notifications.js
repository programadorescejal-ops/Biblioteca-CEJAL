// ============================================
// SISTEMA DE NOTIFICAÇÕES
// Biblioteca CEJAL
// ============================================

class NotificationsSystem {
    constructor() {
        this.notificacoes = [];
        this.listeners = [];
        this.unsubscribe = null;
    }

    // ============================================
    // CRIAR NOTIFICAÇÃO
    // ============================================
    async criarNotificacao(alunoId, tipo, mensagem, dados = {}) {
        try {
            const notificacao = {
                aluno_id: alunoId,
                tipo: tipo, // 'emprestimo', 'devolucao', 'atraso', 'reserva', 'sistema'
                mensagem: mensagem,
                dados: dados,
                lida: false,
                data_criacao: serverTimestamp(),
                data_leitura: null
            };

            const docRef = await db.collection('notificacoes').add(notificacao);
            
            // Notifica em tempo real
            this.notificarAluno(alunoId, notificacao);

            return {
                success: true,
                id: docRef.id,
                data: notificacao
            };

        } catch (error) {
            console.error('Erro ao criar notificação:', error);
            return { success: false, error: error.message };
        }
    }

    // ============================================
    // LISTAR NOTIFICAÇÕES DO ALUNO EM TEMPO REAL
    // ============================================
    listarNotificacoes(alunoId, callback = null) {
        if (this.unsubscribe) {
            this.unsubscribe();
        }

        this.unsubscribe = db.collection('notificacoes')
            .where('aluno_id', '==', alunoId)
            .orderBy('data_criacao', 'desc')
            .onSnapshot((snapshot) => {
                const notificacoes = [];
                snapshot.forEach((doc) => {
                    notificacoes.push({
                        id: doc.id,
                        ...doc.data()
                    });
                });

                this.notificacoes = notificacoes;
                this.notifyListeners(notificacoes);

                if (callback) callback(notificacoes);

            }, (error) => {
                console.error('Erro ao listar notificações:', error);
            });

        return this.unsubscribe;
    }

    // ============================================
    // MARCAR NOTIFICAÇÃO COMO LIDA
    // ============================================
    async marcarComoLida(notificacaoId) {
        try {
            await db.collection('notificacoes').doc(notificacaoId).update({
                lida: true,
                data_leitura: serverTimestamp()
            });

            return { success: true };

        } catch (error) {
            console.error('Erro ao marcar notificação como lida:', error);
            return { success: false, error: error.message };
        }
    }

    // ============================================
    // MARCAR TODAS COMO LIDAS
    // ============================================
    async marcarTodasComoLidas(alunoId) {
        try {
            const snapshot = await db.collection('notificacoes')
                .where('aluno_id', '==', alunoId)
                .where('lida', '==', false)
                .get();

            const batch = db.batch();
            snapshot.forEach((doc) => {
                batch.update(doc.ref, {
                    lida: true,
                    data_leitura: serverTimestamp()
                });
            });

            await batch.commit();

            return { success: true, quantidade: snapshot.size };

        } catch (error) {
            console.error('Erro ao marcar todas como lidas:', error);
            return { success: false, error: error.message };
        }
    }

    // ============================================
    // CONTAR NOTIFICAÇÕES NÃO LIDAS
    // ============================================
    async contarNaoLidas(alunoId) {
        try {
            const snapshot = await db.collection('notificacoes')
                .where('aluno_id', '==', alunoId)
                .where('lida', '==', false)
                .get();

            return snapshot.size;

        } catch (error) {
            console.error('Erro ao contar notificações não lidas:', error);
            return 0;
        }
    }

    // ============================================
    // NOTIFICAR ALUNO (EM TEMPO REAL)
    // ============================================
    notificarAluno(alunoId, notificacao) {
        // Emite evento para o listener específico do aluno
        const event = new CustomEvent(`notificacao-${alunoId}`, {
            detail: notificacao
        });
        document.dispatchEvent(event);

        // Mostra toast se estiver na página
        const tiposToast = {
            'emprestimo': '📚 Novo empréstimo!',
            'devolucao': '✅ Devolução registrada!',
            'atraso': '⚠️ Atraso detectado!',
            'reserva': '📌 Livro reservado!',
            'sistema': 'ℹ️ Notificação do sistema'
        };

        const toastMsg = notificacao.mensagem || tiposToast[notificacao.tipo] || 'Nova notificação';
        showToast(toastMsg, 'info', 5000);
    }

    // ============================================
    // GERAR NOTIFICAÇÕES AUTOMÁTICAS
    // ============================================
    async gerarNotificacoesAutomaticas() {
        try {
            // Verifica empréstimos atrasados
            const atrasados = await livrosSystem.verificarAtrasos();

            for (const atraso of atrasados) {
                await this.criarNotificacao(
                    atraso.aluno_id,
                    'atraso',
                    `📖 Livro "${atraso.titulo_livro}" está com ${atraso.dias_atraso} dia(s) de atraso!`,
                    {
                        livro_id: atraso.livro_id,
                        dias_atraso: atraso.dias_atraso,
                        data_devolucao: atraso.data_devolucao_prevista
                    }
                );
            }

            return { success: true, quantidade: atrasados.length };

        } catch (error) {
            console.error('Erro ao gerar notificações automáticas:', error);
            return { success: false, error: error.message };
        }
    }

    // ============================================
    // NOTIFICAR DEVOLUÇÃO PRÓXIMA
    // ============================================
    async notificarDevolucaoProxima() {
        try {
            const hoje = new Date();
            const amanha = new Date();
            amanha.setDate(amanha.getDate() + 1);

            const snapshot = await db.collection('emprestimos')
                .where('status', '==', 'ativo')
                .get();

            for (const doc of snapshot.docs) {
                const emprestimo = doc.data();
                const dataDevolucao = emprestimo.data_devolucao_prevista.toDate();

                // Verifica se a devolução é amanhã
                if (dataDevolucao.toDateString() === amanha.toDateString()) {
                    await this.criarNotificacao(
                        emprestimo.aluno_id,
                        'sistema',
                        `🔔 Lembrete: Devolver "${emprestimo.titulo_livro}" amanhã!`,
                        {
                            livro_id: emprestimo.livro_id,
                            data_devolucao: dataDevolucao
                        }
                    );
                }
            }

            return { success: true };

        } catch (error) {
            console.error('Erro ao notificar devoluções próximas:', error);
            return { success: false, error: error.message };
        }
    }

    // ============================================
    // REMOVER NOTIFICAÇÕES ANTIGAS
    // ============================================
    async limparNotificacoesAntigas(dias = 30) {
        try {
            const dataLimite = new Date();
            dataLimite.setDate(dataLimite.getDate() - dias);

            const snapshot = await db.collection('notificacoes')
                .where('data_criacao', '<', dataLimite)
                .get();

            const batch = db.batch();
            snapshot.forEach((doc) => {
                batch.delete(doc.ref);
            });

            await batch.commit();

            return { success: true, quantidade: snapshot.size };

        } catch (error) {
            console.error('Erro ao limpar notificações antigas:', error);
            return { success: false, error: error.message };
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

    notifyListeners(notificacoes) {
        this.listeners.forEach(callback => {
            try {
                callback(notificacoes);
            } catch (error) {
                console.error('Erro no listener:', error);
            }
        });
    }
}

// ============================================
// INSTÂNCIA GLOBAL
// ============================================
const notificationsSystem = new NotificationsSystem();
window.notificationsSystem = notificationsSystem;