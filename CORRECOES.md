# Correções aplicadas (out/2026)

## Bugs corrigidos

1. **Query dentro de `runTransaction` na devolução**  
   Firestore não permite query livre dentro de transaction. A busca do empréstimo ativo agora é feita **antes** da transaction.

2. **Race condition no empréstimo**  
   Validação do aluno (limite de 3, bloqueio) estava **fora** da transaction. Agora aluno + livro são lidos juntos dentro da transaction.

3. **Arquivo `validarors.js` (typo)**  
   Páginas carregavam `validators.js` → 404. Renomeado para o nome correto.

4. **Capa padrão quebrada**  
   Código usava `assets/images/default-cover.png` mas o arquivo estava em `assets/`. Copiado para o caminho esperado.

5. **Admin sem `requireAdmin`**  
   `admin.html` só checava login. Aluno logado podia abrir o painel. Agora usa `authGuard.requireAdmin()`.

6. **Cadastro de aluno pelo admin deslogava o bibliotecário**  
   `createUserWithEmailAndPassword` troca a sessão. Agora usa **Firebase App secundário** e faz signOut só nele.

7. **Google Books com chave falsa**  
   `key=SUA_CHAVE_API...` gerava erro 400. Chave vazia por padrão + fallback de capa.

8. **`serverTimestamp` frágil**  
   Virou arrow function: `() => firebase.firestore.FieldValue.serverTimestamp()`.

9. **Filtro do catálogo quebrava com gênero/autor nulos**  
   Uso de `(l.genero || '')` etc.

10. **Renovação de empréstimo**  
    Tratava `toDate()` sem checar se já era Date.

11. **Matrícula só 7 dígitos**  
    Agora aceita 5–10 dígitos.

12. **Storage sem try/catch**  
    Se Storage não estiver habilitado, o app não quebra mais.

## Como testar

```bash
cd bliblioteca
firebase serve
# http://localhost:5000
```

Credenciais de teste (se já existirem no projeto):
- Admin: matrícula `admin` / senha `admin2026`
- Aluno: `2026001` / `escola2026`

Lembrete: o UID do admin precisa existir na coleção `admins`.
