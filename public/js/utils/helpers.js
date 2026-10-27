// ============================================
// FUNÇÕES AUXILIARES
// Biblioteca CEJAL
// ============================================

// ============================================
// FORMATAR DATA
// ============================================
function formatarData(timestamp) {
    if (!timestamp) return 'Data não definida';
    try {
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    } catch {
        return 'Data inválida';
    }
}

// ============================================
// FORMATAR DATA E HORA
// ============================================
function formatarDataHora(timestamp) {
    if (!timestamp) return 'Data não definida';
    try {
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch {
        return 'Data inválida';
    }
}

// ============================================
// GERAR ID ÚNICO
// ============================================
function gerarId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

// ============================================
// CAPITALIZAR TEXTO
// ============================================
function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

// ============================================
// TRUNCAR TEXTO
// ============================================
function truncateText(text, maxLength = 50) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substr(0, maxLength) + '...';
}

// ============================================
// VALIDAR EMAIL
// ============================================
function isEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ============================================
// VALIDAR MATRÍCULA
// ============================================
function isMatricula(matricula) {
    return /^\d{5,10}$/.test(String(matricula).trim());
}

// ============================================
// CALCULAR DIAS ENTRE DATAS
// ============================================
function calcularDias(data) {
    const hoje = new Date();
    const diff = hoje - data;
    return Math.floor(diff / (1000 * 60 * 60 * 24));
}

// ============================================
// MOSTRAR TOAST (NOTIFICAÇÃO)
// ============================================
function showToast(message, type = 'info', duration = 4000) {
    const container = document.getElementById('toastContainer');
    if (!container) {
        // Cria container se não existir
        const newContainer = document.createElement('div');
        newContainer.id = 'toastContainer';
        newContainer.className = 'toast-container';
        document.body.appendChild(newContainer);
        return showToast(message, type, duration);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <div class="toast-icon">
            <i class="fas ${type === 'success' ? 'fa-check-circle' : 
                         type === 'error' ? 'fa-exclamation-circle' : 
                         type === 'warning' ? 'fa-exclamation-triangle' : 'fa-info-circle'}"></i>
        </div>
        <div class="toast-message">${message}</div>
        <button class="toast-close" onclick="this.parentElement.remove()"><i class="fas fa-times"></i></button>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        if (toast.parentElement) {
            toast.classList.add('toast-fade-out');
            setTimeout(() => toast.remove(), 300);
        }
    }, duration);
}

// ============================================
// MOSTRAR LOADING
// ============================================
function showLoading(message) {
    const overlay = document.createElement('div');
    overlay.className = 'loading-overlay';
    overlay.innerHTML = `
        <div class="loading-content">
            <div class="spinner-large"></div>
            <p>${message}</p>
        </div>
    `;
    document.body.appendChild(overlay);

    return {
        close: () => {
            if (overlay.parentElement) {
                overlay.remove();
            }
        }
    };
}

// ============================================
// MOSTRAR MODAL DE CONFIRMAÇÃO
// ============================================
function mostrarModal(title, message) {
    return new Promise((resolve) => {
        const modal = document.getElementById('modalConfirmacao');
        if (!modal) {
            // Fallback: usar confirm nativo
            resolve(confirm(`${title}\n\n${message}`));
            return;
        }

        document.getElementById('modalTitle').textContent = title;
        document.getElementById('modalMessage').textContent = message;

        const confirmBtn = document.getElementById('modalConfirmBtn');
        confirmBtn.onclick = () => {
            fecharModal();
            resolve(true);
        };

        // Fechar ao clicar fora
        modal.onclick = (e) => {
            if (e.target === modal) {
                fecharModal();
                resolve(false);
            }
        };

        // Fechar com ESC
        const handleEsc = (e) => {
            if (e.key === 'Escape') {
                fecharModal();
                resolve(false);
                document.removeEventListener('keydown', handleEsc);
            }
        };
        document.addEventListener('keydown', handleEsc);

        modal.classList.add('active');
    });
}

// ============================================
// FECHAR MODAL
// ============================================
function fecharModal() {
    const modal = document.getElementById('modalConfirmacao');
    if (modal) {
        modal.classList.remove('active');
    }
}

// ============================================
// EXPORTAR FUNÇÕES GLOBAIS
// ============================================
window.formatarData = formatarData;
window.formatarDataHora = formatarDataHora;
window.gerarId = gerarId;
window.capitalize = capitalize;
window.truncateText = truncateText;
window.isEmail = isEmail;
window.isMatricula = isMatricula;
window.calcularDias = calcularDias;
window.showToast = showToast;
window.showLoading = showLoading;
window.mostrarModal = mostrarModal;
window.fecharModal = fecharModal;