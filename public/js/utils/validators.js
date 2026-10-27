// ============================================
// VALIDADORES
// Biblioteca CEJAL
// ============================================

class Validators {
    // ============================================
    // VALIDAR NOME
    // ============================================
    static validarNome(nome) {
        if (!nome || nome.trim().length < 3) {
            return { valid: false, message: 'Nome deve ter pelo menos 3 caracteres' };
        }
        if (nome.trim().length > 100) {
            return { valid: false, message: 'Nome muito longo (máx 100 caracteres)' };
        }
        return { valid: true };
    }

    // ============================================
    // VALIDAR MATRÍCULA
    // ============================================
    static validarMatricula(matricula) {
        if (!matricula) {
            return { valid: false, message: 'Matrícula é obrigatória' };
        }
        if (!/^\d{5,10}$/.test(matricula)) {
            return { valid: false, message: 'Matrícula deve ter 7 dígitos' };
        }
        return { valid: true };
    }

    // ============================================
    // VALIDAR EMAIL
    // ============================================
    static validarEmail(email) {
        if (!email) {
            return { valid: false, message: 'Email é obrigatório' };
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return { valid: false, message: 'Email inválido' };
        }
        return { valid: true };
    }

    // ============================================
    // VALIDAR SENHA
    // ============================================
    static validarSenha(senha) {
        if (!senha) {
            return { valid: false, message: 'Senha é obrigatória' };
        }
        if (senha.length < 6) {
            return { valid: false, message: 'Senha deve ter pelo menos 6 caracteres' };
        }
        if (senha.length > 30) {
            return { valid: false, message: 'Senha muito longa (máx 30 caracteres)' };
        }
        return { valid: true };
    }

    // ============================================
    // VALIDAR CONFIRMAÇÃO DE SENHA
    // ============================================
    static validarConfirmacaoSenha(senha, confirmacao) {
        if (senha !== confirmacao) {
            return { valid: false, message: 'As senhas não coincidem' };
        }
        return { valid: true };
    }

    // ============================================
    // VALIDAR SÉRIE
    // ============================================
    static validarSerie(serie) {
        const series = ['6º Ano', '7º Ano', '8º Ano', '9º Ano', '1º Ano EM', '2º Ano EM', '3º Ano EM'];
        if (!serie || !series.includes(serie)) {
            return { valid: false, message: 'Série inválida' };
        }
        return { valid: true };
    }

    // ============================================
    // VALIDAR TURMA
    // ============================================
    static validarTurma(turma) {
        const turmas = ['A', 'B', 'C', 'D'];
        if (!turma || !turmas.includes(turma)) {
            return { valid: false, message: 'Turma inválida' };
        }
        return { valid: true };
    }

    // ============================================
    // VALIDAR TÍTULO DO LIVRO
    // ============================================
    static validarTitulo(titulo) {
        if (!titulo || titulo.trim().length < 2) {
            return { valid: false, message: 'Título deve ter pelo menos 2 caracteres' };
        }
        if (titulo.trim().length > 100) {
            return { valid: false, message: 'Título muito longo (máx 100 caracteres)' };
        }
        return { valid: true };
    }

    // ============================================
    // VALIDAR AUTOR
    // ============================================
    static validarAutor(autor) {
        if (!autor || autor.trim().length < 2) {
            return { valid: false, message: 'Autor deve ter pelo menos 2 caracteres' };
        }
        if (autor.trim().length > 80) {
            return { valid: false, message: 'Autor muito longo (máx 80 caracteres)' };
        }
        return { valid: true };
    }

    // ============================================
    // VALIDAR GÊNERO
    // ============================================
    static validarGenero(genero) {
        const generos = [
            'Fantasia', 'Ficção Científica', 'Romance', 'Drama', 'Mistério',
            'Literatura Brasileira', 'Infantil', 'Autoajuda', 'Biografia',
            'Filosofia', 'Realismo Mágico', 'Graphic Novel'
        ];
        if (!genero || !generos.includes(genero)) {
            return { valid: false, message: 'Gênero inválido' };
        }
        return { valid: true };
    }

    // ============================================
    // VALIDAR QUANTIDADE
    // ============================================
    static validarQuantidade(quantidade) {
        const num = parseInt(quantidade);
        if (isNaN(num) || num < 1) {
            return { valid: false, message: 'Quantidade deve ser maior que 0' };
        }
        if (num > 100) {
            return { valid: false, message: 'Quantidade máxima é 100' };
        }
        return { valid: true };
    }

    // ============================================
    // VALIDAR FORMULÁRIO COMPLETO DE CADASTRO
    // ============================================
    static validarCadastro(dados) {
        const validacoes = [
            this.validarNome(dados.nome),
            this.validarMatricula(dados.matricula),
            this.validarSerie(dados.serie),
            this.validarTurma(dados.turma),
            this.validarSenha(dados.senha),
            this.validarConfirmacaoSenha(dados.senha, dados.confirmarSenha)
        ];

        for (const v of validacoes) {
            if (!v.valid) {
                return v;
            }
        }

        return { valid: true };
    }

    // ============================================
    // VALIDAR FORMULÁRIO DE LIVRO
    // ============================================
    static validarLivro(dados) {
        const validacoes = [
            this.validarTitulo(dados.titulo),
            this.validarAutor(dados.autor),
            this.validarGenero(dados.genero),
            this.validarQuantidade(dados.quantidade)
        ];

        for (const v of validacoes) {
            if (!v.valid) {
                return v;
            }
        }

        return { valid: true };
    }

    // ============================================
    // SANITIZAR TEXTO
    // ============================================
    static sanitizar(texto) {
        if (!texto) return '';
        return texto
            .trim()
            .replace(/[<>]/g, '') // Remove tags HTML
            .replace(/\s+/g, ' '); // Remove espaços extras
    }

    // ============================================
    // SANITIZAR EMAIL
    // ============================================
    static sanitizarEmail(email) {
        if (!email) return '';
        return email.trim().toLowerCase();
    }

    // ============================================
    // SANITIZAR MATRÍCULA
    // ============================================
    static sanitizarMatricula(matricula) {
        if (!matricula) return '';
        return matricula.trim().replace(/\D/g, ''); // Remove não-dígitos
    }
}

// ============================================
// EXPORTAR VALIDADORES GLOBAIS
// ============================================
window.Validators = Validators;