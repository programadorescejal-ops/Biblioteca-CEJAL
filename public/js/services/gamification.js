// ============================================
// SISTEMA DE GAMIFICAÇÃO
// Biblioteca CEJAL
// ============================================

class GamificationSystem {
    constructor() {
        this.badges = [];
        this.ranking = [];
        this.pontuacao = {};
        this.listeners = [];
    }

    // ============================================
    // BADGES DISPONÍVEIS
    // ============================================
    static get BADGES() {
        return {
            // Badges de quantidade
            LEITOR_INICIANTE: {
                id: 'leitor_iniciante',
                nome: '📚 Leitor Iniciante',
                descricao: 'Leu 3 livros',
                icone: '📚',
                cor: '#4CAF50',
                condicao: (total) => total >= 3
            },
            LEITOR_ÁVIDO: {
                id: 'leitor_avido',
                nome: '📚 Leitor Ávido',
                descricao: 'Leu 10 livros',
                icone: '📖',
                cor: '#2196F3',
                condicao: (total) => total >= 10
            },
            MESTRE_DOS_LIVROS: {
                id: 'mestre_livros',
                nome: '🏆 Mestre dos Livros',
                descricao: 'Leu 30 livros',
                icone: '🏆',
                cor: '#FF9800',
                condicao: (total) => total >= 30
            },
            LENDA_BIBLIOTECA: {
                id: 'lenda_biblioteca',
                nome: '📜 Lenda da Biblioteca',
                descricao: 'Leu 50 livros',
                icone: '📜',
                cor: '#9C27B0',
                condicao: (total) => total >= 50
            },

            // Badges de gênero
            EXPLORADOR_FANTASIA: {
                id: 'explorador_fantasia',
                nome: '🐉 Explorador de Fantasia',
                descricao: 'Leu 5 livros de Fantasia',
                icone: '🐉',
                cor: '#9C27B0',
                condicaoGenero: (livros, genero) => livros.filter(l => l.genero === 'Fantasia').length >= 5,
                genero: 'Fantasia'
            },
            VIAJANTE_ESPACIAL: {
                id: 'viajante_espacial',
                nome: '🚀 Viajante Espacial',
                descricao: 'Leu 5 livros de Ficção Científica',
                icone: '🚀',
                cor: '#00BCD4',
                condicaoGenero: (livros, genero) => livros.filter(l => l.genero === 'Ficção Científica').length >= 5,
                genero: 'Ficção Científica'
            },
            LEITOR_BRASILEIRO: {
                id: 'leitor_brasileiro',
                nome: '🇧🇷 Leitor Brasileiro',
                descricao: 'Leu 5 livros de Literatura Brasileira',
                icone: '🇧🇷',
                cor: '#4CAF50',
                condicaoGenero: (livros, genero) => livros.filter(l => l.genero === 'Literatura Brasileira').length >= 5,
                genero: 'Literatura Brasileira'
            },
            LEITOR_CLASSICOS: {
                id: 'leitor_classicos',
                nome: '📜 Leitor de Clássicos',
                descricao: 'Leu 5 livros de Clássicos',
                icone: '📜',
                cor: '#795548',
                condicaoGenero: (livros, genero) => {
                    const classicos = ['Drama', 'Romance', 'Literatura Brasileira'];
                    return livros.filter(l => classicos.includes(l.genero)).length >= 5;
                },
                genero: 'Clássicos'
            },

            // Badges especiais
            PRIMEIRO_EMPRESTIMO: {
                id: 'primeiro_emprestimo',
                nome: '🌟 Primeiro Empréstimo',
                descricao: 'Pegou seu primeiro livro emprestado',
                icone: '🌟',
                cor: '#FFC107',
                condicao: (total, primeiro) => primeiro === true
            },
            DEVOLUCAO_RAPIDA: {
                id: 'devolucao_rapida',
                nome: '⚡ Devolução Rápida',
                descricao: 'Devolveu um livro antes do prazo',
                icone: '⚡',
                cor: '#FF5722',
                condicaoEspecial: 'devolucao_rapida'
            },
            LEITOR_PERSISTENTE: {
                id: 'leitor_persistente',
                nome: '🔥 Leitor Persistente',
                descricao: 'Manteve uma leitura por 30 dias seguidos',
                icone: '🔥',
                cor: '#E91E63',
                condicaoEspecial: 'leitor_persistente'
            }
        };
    }

    // ============================================
    // CALCULAR PONTUAÇÃO DO ALUNO
    // ============================================
    calcularPontuacao(aluno) {
        let pontos = 0;

        // Pontos por livros lidos
        pontos += (aluno.total_lidos || 0) * 10;

        // Pontos por badges
        const badges = aluno.badges || [];
        pontos += badges.length * 5;

        // Bônus por empréstimos atuais
        const livrosAtuais = aluno.livros_atuais || [];
        pontos += livrosAtuais.length * 2;

        // Bônus por leitura consistente
        const diasLeitor = Math.floor((new Date() - aluno.data_cadastro.toDate()) / (1000 * 60 * 60 * 24));
        if (diasLeitor > 30) pontos += 10;
        if (diasLeitor > 90) pontos += 20;
        if (diasLeitor > 180) pontos += 30;

        return pontos;
    }

    // ============================================
    // VERIFICAR E ATUALIZAR BADGES
    // ============================================
    async verificarBadges(alunoId) {
        try {
            const aluno = await alunosSystem.carregarAluno(alunoId);
            if (!aluno) {
                return { success: false, error: 'Aluno não encontrado' };
            }

            const historico = await alunosSystem.obterHistorico(alunoId);
            const badgesAtuais = aluno.badges || [];
            const novasBadges = [];

            // Verifica cada badge
            const badgeList = Object.values(GamificationSystem.BADGES);
            
            for (const badge of badgeList) {
                // Verifica se já tem o badge
                if (badgesAtuais.some(b => b.includes(badge.nome) || b.includes(badge.id))) {
                    continue;
                }

                let conquistado = false;

                // Condição de quantidade
                if (badge.condicao && typeof badge.condicao === 'function') {
                    conquistado = badge.condicao(aluno.total_lidos || 0);
                }

                // Condição de gênero
                if (badge.condicaoGenero && typeof badge.condicaoGenero === 'function') {
                    conquistado = badge.condicaoGenero(historico, badge.genero);
                }

                // Condição especial: primeiro empréstimo
                if (badge.id === 'primeiro_emprestimo') {
                    conquistado = (aluno.total_lidos || 0) >= 1 && (aluno.total_lidos || 0) <= 1;
                }

                // Condição especial: devolução rápida
                if (badge.id === 'devolucao_rapida') {
                    // Verifica se tem devoluções antes do prazo
                    const emprestimos = await emprestimosSystem.listarHistorico(alunoId);
                    const rapidas = emprestimos.filter(e => {
                        const prevista = e.data_devolucao_prevista.toDate();
                        const real = e.data_devolucao_real?.toDate();
                        if (!real) return false;
                        return real < prevista;
                    });
                    conquistado = rapidas.length >= 3;
                }

                // Condição especial: leitor persistente
                if (badge.id === 'leitor_persistente') {
                    const dias = Math.floor((new Date() - aluno.data_cadastro.toDate()) / (1000 * 60 * 60 * 24));
                    conquistado = dias >= 30 && (aluno.total_lidos || 0) >= 5;
                }

                if (conquistado) {
                    novasBadges.push(badge.nome);
                }
            }

            if (novasBadges.length > 0) {
                const todasBadges = [...badgesAtuais, ...novasBadges];
                await alunosSystem.atualizarAluno(alunoId, { badges: todasBadges });

                // Notifica novas conquistas
                for (const badge of novasBadges) {
                    await notificationsSystem.criarNotificacao(
                        alunoId,
                        'sistema',
                        `🎉 Nova conquista: ${badge}!`,
                        { badge: badge }
                    );
                    showToast(`🎉 Parabéns! Você conquistou: ${badge}`, 'success', 6000);
                }
            }

            return {
                success: true,
                badges: novasBadges,
                total: [...badgesAtuais, ...novasBadges]
            };

        } catch (error) {
            console.error('Erro ao verificar badges:', error);
            return { success: false, error: error.message };
        }
    }

    // ============================================
    // GERAR RANKING DE ALUNOS
    // ============================================
    async gerarRanking(limit = 10) {
        try {
            const snapshot = await db.collection('alunos')
                .orderBy('total_lidos', 'desc')
                .limit(limit)
                .get();

            const ranking = [];
            for (const doc of snapshot.docs) {
                const aluno = { id: doc.id, ...doc.data() };
                const pontos = this.calcularPontuacao(aluno);
                ranking.push({
                    ...aluno,
                    pontos: pontos,
                    badges_count: (aluno.badges || []).length
                });
            }

            this.ranking = ranking;
            this.notifyListeners(ranking);

            return ranking;

        } catch (error) {
            console.error('Erro ao gerar ranking:', error);
            return [];
        }
    }

    // ============================================
    // GERAR RANKING SEMANAL
    // ============================================
    async gerarRankingSemanal(limit = 10) {
        try {
            const dataSemana = new Date();
            dataSemana.setDate(dataSemana.getDate() - 7);

            // Busca empréstimos da última semana
            const snapshot = await db.collection('emprestimos')
                .where('data_emprestimo', '>=', dataSemana)
                .get();

            // Conta empréstimos por aluno
            const contagem = {};
            snapshot.forEach(doc => {
                const emp = doc.data();
                contagem[emp.aluno_id] = (contagem[emp.aluno_id] || 0) + 1;
            });

            // Ordena por contagem
            const ranking = Object.entries(contagem)
                .sort((a, b) => b[1] - a[1])
                .slice(0, limit);

            // Busca dados dos alunos
            const resultado = [];
            for (const [alunoId, quantidade] of ranking) {
                const aluno = await alunosSystem.carregarAluno(alunoId);
                if (aluno) {
                    resultado.push({
                        ...aluno,
                        emprestimos_semana: quantidade
                    });
                }
            }

            return resultado;

        } catch (error) {
            console.error('Erro ao gerar ranking semanal:', error);
            return [];
        }
    }

    // ============================================
    // OBTER PRÓXIMO BADGE
    // ============================================
    async obterProximoBadge(alunoId) {
        try {
            const aluno = await alunosSystem.carregarAluno(alunoId);
            if (!aluno) {
                return null;
            }

            const badgesAtuais = aluno.badges || [];
            const historico = await alunosSystem.obterHistorico(alunoId);

            // Encontra o próximo badge mais próximo
            let proximo = null;
            let menorDiferenca = Infinity;

            const badgeList = Object.values(GamificationSystem.BADGES);
            for (const badge of badgeList) {
                // Pula badges já conquistados
                if (badgesAtuais.some(b => b.includes(badge.nome) || b.includes(badge.id))) {
                    continue;
                }

                let progresso = 0;
                let total = 0;

                // Badge de quantidade
                if (badge.condicao && typeof badge.condicao === 'function') {
                    // Calcula progresso baseado no total de livros
                    const totalLidos = aluno.total_lidos || 0;
                    if (badge.id === 'leitor_iniciante') {
                        progresso = Math.min(totalLidos, 3);
                        total = 3;
                    } else if (badge.id === 'leitor_avido') {
                        progresso = Math.min(totalLidos, 10);
                        total = 10;
                    } else if (badge.id === 'mestre_livros') {
                        progresso = Math.min(totalLidos, 30);
                        total = 30;
                    } else if (badge.id === 'lenda_biblioteca') {
                        progresso = Math.min(totalLidos, 50);
                        total = 50;
                    }
                }

                // Badge de gênero
                if (badge.condicaoGenero && typeof badge.condicaoGenero === 'function') {
                    const count = historico.filter(l => l.genero === badge.genero).length;
                    progresso = Math.min(count, 5);
                    total = 5;
                }

                // Badge especial
                if (badge.id === 'primeiro_emprestimo') {
                    progresso = (aluno.total_lidos || 0) >= 1 ? 1 : 0;
                    total = 1;
                }
                if (badge.id === 'devolucao_rapida') {
                    const emprestimos = await emprestimosSystem.listarHistorico(alunoId);
                    const rapidas = emprestimos.filter(e => {
                        const prevista = e.data_devolucao_prevista.toDate();
                        const real = e.data_devolucao_real?.toDate();
                        if (!real) return false;
                        return real < prevista;
                    });
                    progresso = Math.min(rapidas.length, 3);
                    total = 3;
                }
                if (badge.id === 'leitor_persistente') {
                    const dias = Math.floor((new Date() - aluno.data_cadastro.toDate()) / (1000 * 60 * 60 * 24));
                    progresso = Math.min(dias, 30);
                    total = 30;
                }

                if (total > 0) {
                    const diferenca = total - progresso;
                    if (diferenca < menorDiferenca && progresso < total) {
                        menorDiferenca = diferenca;
                        proximo = {
                            ...badge,
                            progresso: progresso,
                            total: total,
                            porcentagem: Math.round((progresso / total) * 100)
                        };
                    }
                }
            }

            return proximo;

        } catch (error) {
            console.error('Erro ao obter próximo badge:', error);
            return null;
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

    notifyListeners(ranking) {
        this.listeners.forEach(callback => {
            try {
                callback(ranking);
            } catch (error) {
                console.error('Erro no listener:', error);
            }
        });
    }
}

// ============================================
// INSTÂNCIA GLOBAL
// ============================================
const gamificationSystem = new GamificationSystem();
window.gamificationSystem = gamificationSystem;