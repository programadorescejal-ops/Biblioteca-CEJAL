# Sugestões de melhoria (próximos passos)

## Prioridade alta (ainda em teste)

1. **Índices compostos no Firestore**  
   Deploy: `firebase deploy --only firestore:indexes`  
   Consultas `emprestimos` com `aluno_id + status` e `livro_id + aluno_id + status` precisam de índice.

2. **Renovação só se não estiver atrasado**  
   Hoje renova mesmo atrasado. Bloquear se `data_devolucao_prevista < now`.

3. **Feedback de loading global**  
   Já existe `showLoading`; usar em todas as ações (emprestar/devolver/salvar).

4. **Recarregar `userData` após empréstimo**  
   No `index.html`, após pegar/devolver, atualizar `userData.livros_atuais` a partir do Firestore (não só local).

## UX

5. **PWA simples** — `manifest.json` + service worker mínimo para “instalar” no celular.
6. **Filtro por gênero** com chips (Fantasia, Didático…) no catálogo.
7. **Mostrar data de devolução no card** quando o livro for “meu”.
8. **Confirmação** antes de devolver/bloquear (modal em vez de só toast).

## Produção (quando for endurecer segurança)

9. **Restringir updates de `livros` e `alunos`** nas rules com `diff().affectedKeys()` — aluno só pode mudar campos de empréstimo.
10. **Cloud Function** para criar aluno (Admin SDK) em vez de app secundário no client.
11. **Não expor apiKey sensível** além do necessário (Firebase web keys são públicas, mas regras devem ser rígidas).
12. **Rate limit** em cadastro/login (App Check).
13. **Backup automático** export periódico do Firestore.

## Código / organização

14. Unificar CSS (`themes.css` quase não é linkado; `main.css` já tem `:root`).
15. Remover módulos mortos se não usar gamification/notifications nas páginas.
16. Não versionar `node_modules` nem `firebase-debug.log` no zip.
17. Testes manuais checklist (T01–T06 do manual original).

## Mobile Android

18. Preferir carregar a URL de produção (`https://biblioteca-7daf5.web.app`) no WebView em vez de `file://` — evita problemas de CORS/Firebase Auth com file protocol.
