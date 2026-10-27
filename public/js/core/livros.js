// ============================================
// SISTEMA DE LIVROS - Biblioteca CEJAL
// ============================================

class LivrosSystem {
    constructor() {
        this.livros = [];
        this.listeners = [];
        this.unsubscribe = null;
    }

    listarLivrosEmTempoReal(filtro = null, callback = null) {
        if (this.unsubscribe) this.unsubscribe();

        let query = db.collection('livros').orderBy('titulo');

        // Nota: filtro de busca por range no Firestore exige índice;
        // filtramos no client quando há texto livre.
        if (filtro && filtro.genero) {
            query = query.where('genero', '==', filtro.genero);
        }

        this.unsubscribe = query.onSnapshot((snapshot) => {
            let livros = [];
            snapshot.forEach((doc) => {
                livros.push({ id: doc.id, ...doc.data() });
            });

            if (filtro && filtro.busca) {
                const t = filtro.busca.toLowerCase();
                livros = livros.filter(l =>
                    (l.titulo || '').toLowerCase().includes(t) ||
                    (l.autor || '').toLowerCase().includes(t) ||
                    (l.genero || '').toLowerCase().includes(t) ||
                    (l.titulo_busca || '').includes(t)
                );
            }

            this.livros = livros;
            this.notifyListeners(livros);
            if (callback) callback(livros);
        }, (error) => {
            console.error('Erro ao listar livros:', error);
        });

        return this.unsubscribe;
    }

    async adicionarLivro(dados) {
        try {
            const { titulo, autor, genero, quantidade = 1 } = dados;
            let capaUrl = 'assets/images/default-cover.png';

            try {
                if (typeof googleBooksService !== 'undefined') {
                    const capa = await googleBooksService.buscarCapa(titulo, autor);
                    if (capa) capaUrl = capa;
                }
            } catch (e) {
                console.warn('Capa padrão (API indisponível)');
            }

            const livroData = {
                titulo: titulo.trim(),
                autor: autor.trim(),
                genero: genero,
                capaUrl: capaUrl,
                disponivel: true,
                quantidade_total: quantidade,
                quantidade_disponivel: quantidade,
                emprestado_para: [],
                data_cadastro: serverTimestamp(),
                titulo_busca: titulo.trim().toLowerCase(),
                total_emprestimos: 0
            };

            const docRef = await db.collection('livros').add(livroData);
            return { success: true, id: docRef.id, data: livroData };
        } catch (error) {
            console.error('Erro ao adicionar livro:', error);
            return { success: false, error: error.message };
        }
    }

    async removerLivro(livroId) {
        try {
            const livroRef = db.collection('livros').doc(livroId);
            const livroDoc = await livroRef.get();

            if (!livroDoc.exists) {
                return { success: false, error: 'Livro não encontrado' };
            }

            const livro = livroDoc.data();
            if (livro.quantidade_disponivel < livro.quantidade_total) {
                return { success: false, error: 'Livro está emprestado, não pode ser removido' };
            }

            await livroRef.delete();
            return { success: true };
        } catch (error) {
            console.error('Erro ao remover livro:', error);
            return { success: false, error: error.message };
        }
    }

    // ============================================
    // EMPRÉSTIMO ATÔMICO (tudo dentro da transaction)
    // ============================================
    async pegarEmprestimo(livroId, alunoId) {
        try {
            const alunoRef = db.collection('alunos').doc(alunoId);
            const livroRef = db.collection('livros').doc(livroId);

            const result = await db.runTransaction(async (transaction) => {
                // Lê aluno E livro DENTRO da transaction (evita race condition)
                const alunoDoc = await transaction.get(alunoRef);
                const livroDoc = await transaction.get(livroRef);

                if (!alunoDoc.exists) throw new Error('Aluno não encontrado');
                if (!livroDoc.exists) throw new Error('Livro não encontrado');

                const aluno = alunoDoc.data();
                const livro = livroDoc.data();

                if (aluno.bloqueado) {
                    throw new Error(`Conta bloqueada: ${aluno.motivo_bloqueio || 'Procure a biblioteca'}`);
                }
                if ((aluno.livros_atuais || []).length >= 3) {
                    throw new Error('Você já tem 3 livros emprestados');
                }
                if ((aluno.livros_atuais || []).includes(livroId)) {
                    throw new Error('Você já pegou este livro emprestado');
                }
                if ((livro.quantidade_disponivel || 0) <= 0) {
                    throw new Error('Livro não está disponível');
                }

                const dataEmprestimo = new Date();
                const dataDevolucao = new Date();
                dataDevolucao.setDate(dataDevolucao.getDate() + 7);

                transaction.update(livroRef, {
                    quantidade_disponivel: livro.quantidade_disponivel - 1,
                    emprestado_para: [...(livro.emprestado_para || []), alunoId],
                    total_emprestimos: (livro.total_emprestimos || 0) + 1
                });

                transaction.update(alunoRef, {
                    livros_atuais: [...(aluno.livros_atuais || []), livroId],
                    ultimo_emprestimo: new Date()
                });

                const emprestimoRef = db.collection('emprestimos').doc();
                transaction.set(emprestimoRef, {
                    livro_id: livroId,
                    aluno_id: alunoId,
                    titulo_livro: livro.titulo,
                    data_emprestimo: dataEmprestimo,
                    data_devolucao_prevista: dataDevolucao,
                    data_devolucao_real: null,
                    status: 'ativo',
                    renovado: false
                });

                return {
                    dataEmprestimo,
                    dataDevolucao,
                    emprestimoId: emprestimoRef.id
                };
            });

            return { success: true, ...result };
        } catch (error) {
            console.error('Erro no empréstimo:', error);
            return { success: false, error: error.message };
        }
    }

    // ============================================
    // DEVOLUÇÃO (query FORA da transaction)
    // ============================================
    async devolverLivro(livroId, alunoId) {
        try {
            // Query ANTES da transaction — Firestore não permite query livre dentro de runTransaction
            const empSnap = await db.collection('emprestimos')
                .where('livro_id', '==', livroId)
                .where('aluno_id', '==', alunoId)
                .where('status', '==', 'ativo')
                .limit(1)
                .get();

            const alunoRef = db.collection('alunos').doc(alunoId);
            const livroRef = db.collection('livros').doc(livroId);

            await db.runTransaction(async (transaction) => {
                const alunoDoc = await transaction.get(alunoRef);
                const livroDoc = await transaction.get(livroRef);

                if (!alunoDoc.exists) throw new Error('Aluno não encontrado');
                if (!livroDoc.exists) throw new Error('Livro não encontrado');

                const aluno = alunoDoc.data();
                const livro = livroDoc.data();

                if (!(aluno.livros_atuais || []).includes(livroId)) {
                    throw new Error('Este livro não está com o aluno');
                }

                transaction.update(livroRef, {
                    quantidade_disponivel: (livro.quantidade_disponivel || 0) + 1,
                    emprestado_para: (livro.emprestado_para || []).filter(id => id !== alunoId)
                });

                transaction.update(alunoRef, {
                    livros_atuais: (aluno.livros_atuais || []).filter(id => id !== livroId),
                    historico: [...(aluno.historico || []), livroId],
                    total_lidos: (aluno.total_lidos || 0) + 1
                });

                if (!empSnap.empty) {
                    transaction.update(empSnap.docs[0].ref, {
                        status: 'devolvido',
                        data_devolucao_real: new Date()
                    });
                }
            });

            return { success: true };
        } catch (error) {
            console.error('Erro na devolução:', error);
            return { success: false, error: error.message };
        }
    }

    async verificarAtrasos() {
        const hoje = new Date();
        const emprestimosAtrasados = [];

        try {
            const snapshot = await db.collection('emprestimos')
                .where('status', '==', 'ativo')
                .get();

            for (const doc of snapshot.docs) {
                const emprestimo = doc.data();
                const raw = emprestimo.data_devolucao_prevista;
                const dataDevolucao = raw && raw.toDate ? raw.toDate() : new Date(raw);
                if (!dataDevolucao || isNaN(dataDevolucao.getTime())) continue;

                if (dataDevolucao < hoje) {
                    const alunoDoc = await db.collection('alunos').doc(emprestimo.aluno_id).get();
                    emprestimosAtrasados.push({
                        id: doc.id,
                        ...emprestimo,
                        aluno: alunoDoc.exists ? alunoDoc.data() : null,
                        dias_atraso: Math.floor((hoje - dataDevolucao) / (1000 * 60 * 60 * 24))
                    });
                }
            }
            return emprestimosAtrasados;
        } catch (error) {
            console.error('Erro ao verificar atrasos:', error);
            return [];
        }
    }

    addListener(callback) {
        this.listeners.push(callback);
        return () => {
            this.listeners = this.listeners.filter(cb => cb !== callback);
        };
    }

    notifyListeners(livros) {
        this.listeners.forEach(callback => {
            try { callback(livros); } catch (error) {
                console.error('Erro no listener:', error);
            }
        });
    }
}

const livrosSystem = new LivrosSystem();
window.livrosSystem = livrosSystem;
