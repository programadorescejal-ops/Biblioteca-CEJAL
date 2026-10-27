// ============================================
// GOOGLE BOOKS API - Biblioteca CEJAL
// ============================================

class GoogleBooksService {
    constructor() {
        // Sem chave a API funciona com limite baixo (ok para testes escolares).
        // Se tiver chave: coloque aqui. Deixe vazio para não enviar key inválida.
        this.apiKey = '';
        this.baseUrl = 'https://www.googleapis.com/books/v1/volumes';
    }

    async buscarCapa(titulo, autor = null) {
        try {
            let query = `intitle:${encodeURIComponent(titulo)}`;
            if (autor) query += `+inauthor:${encodeURIComponent(autor)}`;

            let url = `${this.baseUrl}?q=${query}&maxResults=1`;
            if (this.apiKey) url += `&key=${this.apiKey}`;

            const response = await fetch(url);
            if (!response.ok) {
                console.warn('Google Books status:', response.status);
                return this.fallback();
            }

            const data = await response.json();
            if (!data.items || data.items.length === 0) {
                return await this.buscarCapaAmpla(titulo);
            }

            return this.extractCapa(data.items[0]) || this.fallback();
        } catch (error) {
            console.error('Erro na busca da capa:', error);
            return this.fallback();
        }
    }

    async buscarCapaAmpla(titulo) {
        try {
            let url = `${this.baseUrl}?q=${encodeURIComponent(titulo)}&maxResults=1`;
            if (this.apiKey) url += `&key=${this.apiKey}`;
            const response = await fetch(url);
            if (!response.ok) return this.fallback();
            const data = await response.json();
            if (!data.items || data.items.length === 0) return this.fallback();
            return this.extractCapa(data.items[0]) || this.fallback();
        } catch (error) {
            return this.fallback();
        }
    }

    extractCapa(livro) {
        const imageLinks = livro.volumeInfo && livro.volumeInfo.imageLinks;
        if (!imageLinks) return null;
        const url = imageLinks.extraLarge || imageLinks.large ||
                    imageLinks.medium || imageLinks.thumbnail || imageLinks.smallThumbnail;
        if (!url) return null;
        // HTTPS obrigatório (evita mixed content)
        return url.replace('http://', 'https://');
    }

    fallback() {
        return 'assets/images/default-cover.png';
    }
}

const googleBooksService = new GoogleBooksService();
window.googleBooksService = googleBooksService;
