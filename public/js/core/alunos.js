// ============================================
// SISTEMA DE ALUNOS
// Biblioteca CEJAL
// ============================================

class AlunosSystem {
    constructor() {
        this.alunos = [];
        this.alunoAtual = null;
        this.listeners = [];
        this.unsubscribe = null;
    }

    // ============================================
    // CARREGAR DADOS DO ALUNO
    // ============================================
    async carregarAluno(alunoId) {
        try {
            const doc = await db.collection('alunos').doc(alunoId).get();
            if (doc.exists) {
                this.alunoAtual = { id: alunoId, ...doc.data() };
                return this.alunoAtual;
            }
            return null;
        } catch (error) {
            console.error('Erro ao carregar aluno:', error);
            return null;
        }
    }

    // ============================================
    // LISTAR ALUNOS EM TEMPO REAL (ADMIN)
    // ============================================
    listarAlunosEmTempoReal(callback = null) {
        if (this.unsubscribe) {
            this.unsubscribe();
        }

        this.unsubscribe = db.collection('alunos')
            .orderBy('nome')
            .onSnapshot((snapshot) => {
                const alunos = [];
                snapshot.forEach((doc) => {
                    alunos.push({
                        id: doc.id,
                        ...doc.data()
                    });
                });

                this.alunos = alunos;
                this.notifyListeners(alunos);

                if (callback) callback(alunos);

            }, (error) => {
                console.error('Erro ao listar alunos:', error);
            });

        return this.unsubscribe;
    }

    // ============================================
    // BUSCAR ALUNO POR MATRÍCULA
    // ============================================
    async buscarPorMatricula(matricula) {
        try {
            const snapshot = await db.collection('alunos')
                .where('matricula', '==', matricula)
                .get();

            if (snapshot.empty) {
                return null;
            }

            const doc = snapshot.docs[0];
            return { id: doc.id, ...doc.data() };

        } catch (error) {
            console.error('Erro ao buscar aluno por matrícula:', error);
            return null;
        }
    }

    // ============================================
    // BUSCAR ALUNO POR EMAIL
    // ============================================
    async buscarPorEmail(email) {
        try {
            const snapshot = await db.collection('alunos')
                .where('email', '==', email)
                .get();

            if (snapshot.empty) {
                return null;
            }

            const doc = snapshot.docs[0];
            return { id: doc.id, ...doc.data() };

        } catch (error) {
            console.error('Erro ao buscar aluno por email:', error);
            return null;
        }
    }

    // ============================================
    // ATUALIZAR DADOS DO ALUNO
    // ============================================
    async atualizarAluno(alunoId, dados) {
        try {
            const alunoRef = db.collection('alunos').doc(alunoId);
            
            // Remove campos vazios
            Object.keys(dados).forEach(key => {
                if (dados[key] === undefined || dados[key] === null) {
                    delete dados[key];
                }
            });

            await alunoRef.update({
                ...dados,
                ultima_atualizacao: serverTimestamp()
            });

            // Atualiza cache local
            if (this.alunoAtual && this.alunoAtual.id === alunoId) {
                this.alunoAtual = { ...this.alunoAtual, ...dados };
            }

            return { success: true };

        } catch (error) {
            console.error('Erro ao atualizar aluno:', error);
            return { success: false, error: error.message };
        }
    }

    // ============================================
    // VERIFICAR LIMITE DE LIVROS
    // ============================================
    async podePegarLivro(alunoId) {
        try {
            const aluno = await this.carregarAluno(alunoId);
            if (!aluno) {
                return { pode: false, motivo: 'Aluno não encontrado' };
            }

            if (aluno.bloqueado) {
                return { pode: false, motivo: `Aluno bloqueado: ${aluno.motivo_bloqueio || 'Sem motivo'}` };
            }

            const livrosAtuais = aluno.livros_atuais || [];
            if (livrosAtuais.length >= 3) {
                return { pode: false, motivo: 'Limite máximo de 3 livros atingido' };
            }

            return { pode: true };

        } catch (error) {
            console.error('Erro ao verificar limite:', error);
            return { pode: false, motivo: 'Erro ao verificar' };
        }
    }

    // ============================================
    // VERIFICAR ATRASOS DO ALUNO
    // ============================================
    async verificarAtrasosAluno(alunoId) {
        try {
            const atrasados = await livrosSystem.verificarAtrasos();
            return atrasados.filter(a => a.aluno_id === alunoId);

        } catch (error) {
            console.error('Erro ao verificar atrasos:', error);
            return [];
        }
    }

    // ============================================
    // OBTER HISTÓRICO COMPLETO
    // ============================================
    async obterHistorico(alunoId) {
        try {
            const aluno = await this.carregarAluno(alunoId);
            if (!aluno) {
                return [];
            }

            const historicoIds = aluno.historico || [];
            if (historicoIds.length === 0) {
                return [];
            }

            // Busca detalhes dos livros
            const livros = [];
            for (const id of historicoIds) {
                const doc = await db.collection('livros').doc(id).get();
                if (doc.exists) {
                    livros.push({
                        id: doc.id,
                        ...doc.data()
                    });
                }
            }

            return livros;

        } catch (error) {
            console.error('Erro ao obter histórico:', error);
            return [];
        }
    }

    // ============================================
    // OBTER LIVROS ATUAIS
    // ============================================
    async obterLivrosAtuais(alunoId) {
        try {
            const aluno = await this.carregarAluno(alunoId);
            if (!aluno) {
                return [];
            }

            const livrosIds = aluno.livros_atuais || [];
            if (livrosIds.length === 0) {
                return [];
            }

            // Busca detalhes dos livros
            const livros = [];
            for (const id of livrosIds) {
                const doc = await db.collection('livros').doc(id).get();
                if (doc.exists) {
                    livros.push({
                        id: doc.id,
                        ...doc.data()
                    });
                }
            }

            return livros;

        } catch (error) {
            console.error('Erro ao obter livros atuais:', error);
            return [];
        }
    }

    // ============================================
    // ATUALIZAR BADGES DO ALUNO
    // ============================================
    async atualizarBadges(alunoId) {
        try {
            const aluno = await this.carregarAluno(alunoId);
            if (!aluno) {
                return { success: false, error: 'Aluno não encontrado' };
            }

            const totalLidos = aluno.total_lidos || 0;
            const badges = [];

            // Badge: Leitor Iniciante (3 livros)
            if (totalLidos >= 3) {
                badges.push('📚 Leitor Iniciante');
            }

            // Badge: Leitor Ávido (10 livros)
            if (totalLidos >= 10) {
                badges.push('📚 Leitor Ávido');
            }

            // Badge: Mestre dos Livros (30 livros)
            if (totalLidos >= 30) {
                badges.push('🏆 Mestre dos Livros');
            }

            // Badge: Leitor de Fantasia (5 livros de fantasia)
            const historico = await this.obterHistorico(alunoId);
            const fantasias = historico.filter(l => l.genero === 'Fantasia');
            if (fantasias.length >= 5) {
                badges.push('🐉 Explorador de Fantasia');
            }

            // Badge: Leitor de Ficção Científica (5 livros)
            const ficcao = historico.filter(l => l.genero === 'Ficção Científica');
            if (ficcao.length >= 5) {
                badges.push('🚀 Viajante Espacial');
            }

            // Badge: Leitor de Literatura Brasileira (5 livros)
            const br = historico.filter(l => l.genero === 'Literatura Brasileira');
            if (br.length >= 5) {
                badges.push('🇧🇷 Leitor Brasileiro');
            }

            // Badge: Leitor de Clássicos (5 livros)
            const classicos = historico.filter(l => 
                ['Drama', 'Romance', 'Literatura Brasileira'].includes(l.genero)
            );
            if (classicos.length >= 5) {
                badges.push('📜 Leitor de Clássicos');
            }

            // Atualiza badges
            await this.atualizarAluno(alunoId, { badges: badges });

            return { success: true, badges: badges };

        } catch (error) {
            console.error('Erro ao atualizar badges:', error);
            return { success: false, error: error.message };
        }
    }

    // ============================================
    // GERAR ESTATÍSTICAS DO ALUNO
    // ============================================
    async gerarEstatisticas(alunoId) {
        try {
            const aluno = await this.carregarAluno(alunoId);
            if (!aluno) {
                return null;
            }

            const historico = await this.obterHistorico(alunoId);
            const livrosAtuais = await this.obterLivrosAtuais(alunoId);
            const atrasos = await this.verificarAtrasosAluno(alunoId);

            // Estatísticas por gênero
            const generos = {};
            historico.forEach(l => {
                generos[l.genero] = (generos[l.genero] || 0) + 1;
            });

            // Top gêneros
            const topGeneros = Object.entries(generos)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5);

            return {
                nome: aluno.nome,
                matricula: aluno.matricula,
                total_lidos: aluno.total_lidos || 0,
                livros_atuais: livrosAtuais.length,
                badges: aluno.badges || [],
                atrasos: atrasos.length,
                top_generos: topGeneros,
                total_emprestimos: aluno.total_lidos || 0,
                dias_leitor: Math.floor((new Date() - aluno.data_cadastro.toDate()) / (1000 * 60 * 60 * 24))
            };

        } catch (error) {
            console.error('Erro ao gerar estatísticas:', error);
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

    notifyListeners(alunos) {
        this.listeners.forEach(callback => {
            try {
                callback(alunos);
            } catch (error) {
                console.error('Erro no listener:', error);
            }
        });
    }
}

// ============================================
// INSTÂNCIA GLOBAL
// ============================================
const alunosSystem = new AlunosSystem();
window.alunosSystem = alunosSystem;