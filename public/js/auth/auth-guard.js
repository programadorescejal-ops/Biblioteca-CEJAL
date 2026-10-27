// ============================================
// GUARD DE AUTENTICAÇÃO - PROTEÇÃO DE ROTAS
// Biblioteca CEJAL
// ============================================

class AuthGuard {
    constructor() {
        this.redirectTo = null;
    }

    // ============================================
    // VERIFICA SE USUÁRIO ESTÁ AUTENTICADO
    // ============================================
    async verifyAuth() {
        return new Promise((resolve) => {
            const unsubscribe = auth.onAuthStateChanged((user) => {
                unsubscribe();
                if (user) {
                    resolve(true);
                } else {
                    resolve(false);
                }
            });
        });
    }

    // ============================================
    // EXIGE AUTENTICAÇÃO (REDIRECIONA SE NÃO ESTIVER)
    // ============================================
    async requireAuth() {
        const isLoggedIn = await this.verifyAuth();
        if (!isLoggedIn) {
            window.location.href = 'login.html';
            return false;
        }
        return true;
    }

    // ============================================
    // EXIGE AUTENTICAÇÃO DE ADMIN
    // ============================================
    async requireAdmin() {
        const isLoggedIn = await this.verifyAuth();
        if (!isLoggedIn) {
            window.location.href = 'login.html';
            return false;
        }

        try {
            const adminDoc = await db.collection('admins').doc(auth.currentUser.uid).get();
            if (!adminDoc.exists) {
                window.location.href = 'index.html';
                return false;
            }
            return true;
        } catch (error) {
            console.error('Erro ao verificar admin:', error);
            window.location.href = 'index.html';
            return false;
        }
    }

    // ============================================
    // REDIRECIONA SE JÁ ESTIVER LOGADO
    // ============================================
    async redirectIfLoggedIn() {
        const isLoggedIn = await this.verifyAuth();
        if (isLoggedIn) {
            window.location.href = 'index.html';
            return true;
        }
        return false;
    }

    // ============================================
    // OBTÉM O USUÁRIO ATUAL
    // ============================================
    async getCurrentUser() {
        return new Promise((resolve) => {
            const unsubscribe = auth.onAuthStateChanged((user) => {
                unsubscribe();
                resolve(user);
            });
        });
    }
}

// ============================================
// INSTÂNCIA GLOBAL
// ============================================
const authGuard = new AuthGuard();
window.authGuard = authGuard;