# NeoW Venóclise

PWA pessoal de cálculo de venóclise neonatal (UTI neonatal e sala de parto), pensado para o iPhone/Safari. **Ferramenta de apoio. Confira os cálculos. A decisão e a prescrição são do médico.**

- Motor de cálculo puro e testado em `src/core/` (única fonte de cálculo). A tela só exibe.
- Offline depois do primeiro acesso. Sem backend, sem analytics.
- Regras e fontes: `docs/regras-clinicas.md`, `docs/fontes.md`. Conflitos: `docs/DIVERGENCIAS.md`.

## Instalar no iPhone
1. Abra o endereço do app no **Safari**.
2. Toque em **Compartilhar** → **Adicionar à Tela de Início**.
3. Abra sempre **pelo ícone**: no iOS o app instalado tem armazenamento separado do Safari.

## Rodar
```bash
npm ci
npm run dev        # http://localhost:5178
npm test           # motor + travas
npm run build
npm run icones     # regenera os PNGs a partir de public/icons/icone-mestre.svg
```

## Deploy
GitHub Actions (`.github/workflows/deploy.yml`) roda `npm ci && npm test && npm run build` e publica no GitHub Pages **só se os testes passarem**.
